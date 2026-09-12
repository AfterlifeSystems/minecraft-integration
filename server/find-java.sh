#!/usr/bin/env bash
# Prints a Java 21+ binary. PATH, JAVA_HOME, then the Cursor Red Hat JRE.
find_java() {
  if command -v java >/dev/null 2>&1; then
    command -v java
    return 0
  fi
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    echo "${JAVA_HOME}/bin/java"
    return 0
  fi
  local cursor_java
  cursor_java="$(find "${HOME}/.cursor/extensions" -path '*/jre/*/bin/java' -type f 2>/dev/null | head -n 1 || true)"
  if [[ -n "${cursor_java}" && -x "${cursor_java}" ]]; then
    echo "${cursor_java}"
    return 0
  fi
  echo "Java 21 is required to install and start the Fabric server. Install Temurin 21 or set JAVA_HOME." >&2
  return 1
}
