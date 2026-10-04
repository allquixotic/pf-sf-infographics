# shellcheck shell=sh
# Sourced by start.sh and pfsf.sh. Makes sure a project-local copy of the latest stable Bun lives in
# .runtime/bun/ (git-ignored) and sets BUN to its path.
#
# Environment:
#   PFSF_BUN=/path/to/bun     use this Bun instead (skips download)
#   PFSF_BUN_UPDATE=0         never check for a newer Bun release
#
# The latest release is checked at most once a day. Downloads are verified against Bun's SHASUMS256.txt.

pfsf_log() { printf '%s\n' "$*" >&2; }

pfsf_ensure_bun() {
  if [ -n "${PFSF_BUN:-}" ]; then
    BUN="$PFSF_BUN"
    return 0
  fi

  runtime_dir="$ROOT/.runtime/bun"
  BUN="$runtime_dir/bun"
  mkdir -p "$runtime_dir"

  if command -v curl >/dev/null 2>&1; then
    fetch_to() { curl -fsSL --retry 2 -o "$2" "$1"; }
    head_location() { curl -fsSI "$1" | tr -d '\r' | sed -n 's/^[Ll]ocation: *//p' | tail -n 1; }
  elif command -v wget >/dev/null 2>&1; then
    fetch_to() { wget -q -O "$2" "$1"; }
    head_location() { wget -q -S --max-redirect=0 --spider "$1" 2>&1 | tr -d '\r' | sed -n 's/^ *[Ll]ocation: *//p' | tail -n 1; }
  else
    if [ -x "$BUN" ]; then return 0; fi
    pfsf_log "error: need curl or wget to download Bun"
    return 1
  fi

  # Decide whether to look for a newer release (once a day).
  stamp="$runtime_dir/.checked"
  want_check=1
  [ "${PFSF_BUN_UPDATE:-1}" = "0" ] && want_check=0
  if [ "$want_check" = "1" ] && [ -x "$BUN" ] && [ -f "$stamp" ]; then
    if [ -z "$(find "$stamp" -mmin +1440 2>/dev/null)" ]; then want_check=0; fi
  fi
  if [ "$want_check" = "0" ] && [ -x "$BUN" ]; then return 0; fi

  latest_url="$(head_location https://github.com/oven-sh/bun/releases/latest || true)"
  tag="${latest_url##*/}"
  case "$tag" in
    bun-v*) ;;
    *)
      if [ -x "$BUN" ]; then
        pfsf_log "Could not check for a newer Bun (offline?); using $("$BUN" --version)."
        return 0
      fi
      pfsf_log "error: could not determine the latest Bun release (are you online?)"
      return 1
      ;;
  esac
  touch "$stamp"

  current=""
  [ -x "$BUN" ] && current="bun-v$("$BUN" --version 2>/dev/null || true)"
  if [ "$current" = "$tag" ]; then return 0; fi

  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    FreeBSD) os=freebsd ;;
    MINGW* | MSYS* | CYGWIN*)
      pfsf_log "On Windows, please use start.bat / pfsf.bat."
      return 1
      ;;
    *)
      pfsf_log "error: unsupported OS $os"
      return 1
      ;;
  esac
  case "$arch" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=aarch64 ;;
    *)
      pfsf_log "error: unsupported CPU $arch"
      return 1
      ;;
  esac
  libc=""
  if [ "$os" = linux ]; then
    if [ -f /etc/alpine-release ] || (ldd --version 2>&1 | grep -qi musl); then libc="-musl"; fi
    # Android (Termux) has its own build.
    if [ -n "${ANDROID_ROOT:-}" ]; then libc="-android"; fi
  fi
  # Rosetta 2 reports x86_64; prefer the native build.
  if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = "1" ]; then
    arch=aarch64
  fi

  tmp="$(mktemp -d 2>/dev/null || mktemp -d -t pfsf)"
  trap 'rm -rf "$tmp"' EXIT INT TERM
  base="https://github.com/oven-sh/bun/releases/download/$tag"
  fetch_to "$base/SHASUMS256.txt" "$tmp/SHASUMS256.txt" || {
    pfsf_log "error: could not download Bun checksums"
    return 1
  }

  install_target() {
    target="bun-$os-$arch$libc$1"
    pfsf_log "Downloading $target ($tag)…"
    fetch_to "$base/$target.zip" "$tmp/$target.zip" || return 1
    expected="$(grep " $target.zip\$" "$tmp/SHASUMS256.txt" | cut -d' ' -f1)"
    if command -v sha256sum >/dev/null 2>&1; then
      actual="$(sha256sum "$tmp/$target.zip" | cut -d' ' -f1)"
    else
      actual="$(shasum -a 256 "$tmp/$target.zip" | cut -d' ' -f1)"
    fi
    if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
      pfsf_log "error: checksum mismatch for $target.zip"
      return 1
    fi
    rm -rf "$tmp/x" && mkdir -p "$tmp/x"
    if command -v unzip >/dev/null 2>&1; then
      unzip -q "$tmp/$target.zip" -d "$tmp/x"
    elif command -v python3 >/dev/null 2>&1; then
      python3 -m zipfile -e "$tmp/$target.zip" "$tmp/x"
    else
      bsdtar -xf "$tmp/$target.zip" -C "$tmp/x"
    fi
    chmod +x "$tmp/x/$target/bun"
    # Old CPUs without AVX2 cannot run the default x64 build; the caller retries with -baseline.
    "$tmp/x/$target/bun" --version >/dev/null 2>&1 || return 2
    mv -f "$tmp/x/$target/bun" "$BUN"
  }

  if install_target ""; then :; else
    status=$?
    if [ "$status" = 2 ] && [ "$arch" = x64 ]; then
      install_target "-baseline" || return 1
    else
      return 1
    fi
  fi
  pfsf_log "Using Bun $("$BUN" --version) from $runtime_dir"
  rm -rf "$tmp"
  trap - EXIT INT TERM
}
