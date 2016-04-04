
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![NPM version](http://img.shields.io/npm/v/ssh-live.svg)](https://www.npmjs.org/package/ssh-live)

# ssh-live

### Let others watch your SSH session live via HTTP

Runs SSH and starts a local HTTP server to redirect STDOUT/STDERR to remote
web clients in real-time.

### Installation
```
  npm install -g ssh-live
```

### Usage
```sh
  Usage: ssh-live [options] [hop...] user@hostname[:port]

  Options:

    -h, --help                output usage information
    -l, --logfile <filename>  logfile - defaults to /tmp/ssh-live.log
    -p, --port <port>         http listen port - defaults to 8080

  Example:
    ssh-live foo@bar

  Example using multiple hops:
    ssh-live -p 8080 user1@hop1:2233 user2@hop2 user3@final-dest

```
