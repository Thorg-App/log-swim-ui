#!/usr/bin/env bash
# __enable_bash_strict_mode__

main() {
  cdi.repo_root

  eai2 npm run link:local
  cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --key-level "level" --key-timestamp "timestamp"
}

main "${@}"
