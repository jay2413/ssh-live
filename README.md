
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# ssh-live

### Let others whatch your current SSH session via HTTP

### Usage:
```
  Usage: ssh-live [options] [hop...] user@hostname[:port]

  Options:

    -h, --help                output usage information
    -l, --logfile <filename>  logfile - defaults to /tmp/ssh-live.log
    -p, --port <port>         http listen port - defaults to 5656

  Example:
    ssh-live foo@bar

  Example using multiple hops:
    ssh-live -p 8080 user1@hop1:2233 user2@hop2 user3@final-dest

```
