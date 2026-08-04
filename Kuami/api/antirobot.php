<?php
header('Content-Type: application/json; charset=utf-8');

date_default_timezone_set('America/Asuncion');

/**
 * Anti-robot por IP:
 * - action=new: devuelve un desafío (pregunta) y un token.
 * - action=verify: valida respuesta, aplica penalización +5 min por error.
 *
 * Storage: archivo JSON con bloqueo (flock) => "duro" sin BD.
 */

const STORE_FILE = __DIR__ . '/_antirobot_store.json';
const TOKEN_TTL_SECONDS = 300;       // 5 min para responder un challenge
const PENALTY_SECONDS = 300;         // +5 min por fallo
const MAX_PENALTY_SECONDS = 3600 * 6; // tope opcional: 6 horas

function json_out($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function get_client_ip() {
  // Si usás Cloudflare o proxy, ajustá según tu infra
  $candidates = [
    'HTTP_CF_CONNECTING_IP',
    'HTTP_X_FORWARDED_FOR',
    'HTTP_X_REAL_IP',
    'REMOTE_ADDR'
  ];

  foreach ($candidates as $k) {
    if (!empty($_SERVER[$k])) {
      $v = $_SERVER[$k];

      // X_FORWARDED_FOR puede traer "ip, ip, ip"
      if ($k === 'HTTP_X_FORWARDED_FOR') {
        $parts = array_map('trim', explode(',', $v));
        if (!empty($parts[0])) return $parts[0];
      }

      return trim($v);
    }
  }
  return '0.0.0.0';
}

function load_store() {
  if (!file_exists(STORE_FILE)) return ['ips' => []];
  $raw = file_get_contents(STORE_FILE);
  $data = json_decode($raw, true);
  if (!is_array($data)) return ['ips' => []];
  if (!isset($data['ips']) || !is_array($data['ips'])) $data['ips'] = [];
  return $data;
}

function save_store($data) {
  file_put_contents(STORE_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function now() { return time(); }

function rand_token($len = 32) {
  return bin2hex(random_bytes((int)($len/2)));
}

function make_challenge() {
  // Simple y efectivo: suma/multiplicación con números chicos
  $a = random_int(2, 9);
  $b = random_int(2, 9);
  $ops = ['+', '*'];
  $op = $ops[random_int(0, count($ops) - 1)];

  $ans = ($op === '+') ? ($a + $b) : ($a * $b);
  $q = "{$a} {$op} {$b} = ?";

  return [$q, (string)$ans];
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$action = strtolower(trim($action));
$ip = get_client_ip();

if (!in_array($action, ['new', 'verify'], true)) {
  json_out(['ok' => false, 'error' => 'bad_action'], 400);
}

// Abrimos con lock para evitar carrera
$fp = fopen(STORE_FILE, 'c+');
if (!$fp) json_out(['ok' => false, 'error' => 'store_open_failed'], 500);
flock($fp, LOCK_EX);

// Cargar store desde el file handle para consistencia
$raw = stream_get_contents($fp);
$data = json_decode($raw ?: '', true);
if (!is_array($data)) $data = ['ips' => []];
if (!isset($data['ips']) || !is_array($data['ips'])) $data['ips'] = [];

if (!isset($data['ips'][$ip])) {
  $data['ips'][$ip] = [
    'fails' => 0,
    'blocked_until' => 0,
    'token' => '',
    'token_exp' => 0,
    'answer_hash' => '',
    'last_q' => '',
    'last_seen' => now()
  ];
}
$rec = $data['ips'][$ip];
$rec['last_seen'] = now();

// Limpieza simple: si token expiró, borramos challenge
if (!empty($rec['token']) && $rec['token_exp'] < now()) {
  $rec['token'] = '';
  $rec['token_exp'] = 0;
  $rec['answer_hash'] = '';
  $rec['last_q'] = '';
}

// Si está bloqueado
if ($rec['blocked_until'] > now()) {
  $wait = $rec['blocked_until'] - now();
  $data['ips'][$ip] = $rec;

  // Guardar y liberar lock
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  json_out(['ok' => false, 'blocked' => true, 'wait_seconds' => $wait, 'ip' => $ip]);
}

if ($action === 'new') {
  [$q, $ans] = make_challenge();
  $token = rand_token(32);

  $rec['token'] = $token;
  $rec['token_exp'] = now() + TOKEN_TTL_SECONDS;
  $rec['answer_hash'] = password_hash($ans, PASSWORD_DEFAULT);
  $rec['last_q'] = $q;

  $data['ips'][$ip] = $rec;

  // Guardar y liberar lock
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  json_out([
    'ok' => true,
    'token' => $token,
    'question' => $q,
    'ttl_seconds' => TOKEN_TTL_SECONDS
  ]);
}

if ($action === 'verify') {
  $token = (string)($_POST['token'] ?? '');
  $answer = trim((string)($_POST['answer'] ?? ''));

  if (!$token || !$answer) {
    // penaliza como fallo suave
    $rec['fails'] = (int)$rec['fails'] + 1;
    $penalty = min($rec['fails'] * PENALTY_SECONDS, MAX_PENALTY_SECONDS);
    $rec['blocked_until'] = now() + $penalty;

    $data['ips'][$ip] = $rec;

    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    json_out(['ok' => false, 'error' => 'missing_fields', 'wait_seconds' => $penalty]);
  }

  // token válido?
  if (empty($rec['token']) || $rec['token'] !== $token || $rec['token_exp'] < now() || empty($rec['answer_hash'])) {
    $rec['fails'] = (int)$rec['fails'] + 1;
    $penalty = min($rec['fails'] * PENALTY_SECONDS, MAX_PENALTY_SECONDS);
    $rec['blocked_until'] = now() + $penalty;

    $data['ips'][$ip] = $rec;

    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    json_out(['ok' => false, 'error' => 'token_invalid_or_expired', 'wait_seconds' => $penalty]);
  }

  // verificar respuesta
  $is_ok = password_verify($answer, $rec['answer_hash']);

  if (!$is_ok) {
    $rec['fails'] = (int)$rec['fails'] + 1;
    $penalty = min($rec['fails'] * PENALTY_SECONDS, MAX_PENALTY_SECONDS);
    $rec['blocked_until'] = now() + $penalty;

    // invalidar challenge actual (obliga a pedir uno nuevo)
    $rec['token'] = '';
    $rec['token_exp'] = 0;
    $rec['answer_hash'] = '';
    $rec['last_q'] = '';

    $data['ips'][$ip] = $rec;

    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    json_out(['ok' => false, 'error' => 'wrong_answer', 'wait_seconds' => $penalty]);
  }

  // éxito: resetear fallos y desbloqueo, invalidar challenge
  $rec['fails'] = 0;
  $rec['blocked_until'] = 0;
  $rec['token'] = '';
  $rec['token_exp'] = 0;
  $rec['answer_hash'] = '';
  $rec['last_q'] = '';

  $data['ips'][$ip] = $rec;

  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  json_out(['ok' => true]);
}
