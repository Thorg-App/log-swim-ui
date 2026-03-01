---
id: d60cv5pzkinjq13rpk9jxwrrs
title: "make it work nicer with tail capitol F"
status: open
deps: []
links: []
created_iso: 2026-03-01T14:32:49Z
status_updated_iso: 2026-03-01T14:32:49Z
type: task
priority: 0
assignee: nickolaykondratyev
---

`tail -F some-file | log-swim-ui` should work without any issues. 


Right now we will get an error since we expect valid JSONL on each line but the output from `tail -F` is like the following:

```
{"clazz":"Initializer","level":"info","log_level":"INFO","message":"initializer.deactivate-completed","origin":"vsc_main","sequenceNum":3724,"timestamp":"2026-02-28T23:59:33.345Z","values":[]}

==> vsc_client.2026_03_01.log <==
{"clazz":"NotifyServerFocusWindowChangeHandler","level":"debug","log_level":"DEBUG","message":"VSCode window lost focus, sending UNFOCUS event","origin":"vsc_main","sequenceNum":654,"timestamp":"2026-03-01T14:30:34.102Z","values":[{"description":"note_path","type":"FILE_PATH","value":"/home/nickolaykondratyev/dendron_ws/public/tech.os.unix-like.commands.ssh.ssh-keys.generate-ssh-key.md"}]}
```

HENCE, let's add filtering rules for lines that we should ignore:
- Lines: that start with '==> ' and end with ' <==' should be IGNORED/DROPPED (since they are just separators between different files in the `tail -F` output).
- empty lines should also be IGNORED/DROPPED.