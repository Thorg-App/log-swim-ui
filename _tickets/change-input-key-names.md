---
id: wmtjnten6eiw5repedjlu2tig
title: "change input key names"
status: open
deps: []
links: []
created_iso: 2026-03-01T14:28:47Z
status_updated_iso: 2026-03-01T14:28:47Z
type: task
priority: 0
assignee: nickolaykondratyev
---

TASK: Change the input key fields

FROM:
```sh file=[/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/test_manual.sh] Lines=[8-8]
  cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --key-level "level" --key-timestamp "timestamp"
```

TO:
```sh file=[/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/test_manual.sh] Lines=[8-8]
  cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --input_key.level "level" --input_key.timestamp "timestamp"
```

--------------------------------------------------------------------------------
Also let's change '--lanes' key to be more explicit. From '--lanes' to something like '--regexes_for_filter_columns'