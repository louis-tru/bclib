NAME:
   aleth 1.8.0-7+commit.ee5ca377.dirty
USAGE:
   aleth [options]

WALLET USAGE:
   account list                                List all keys available in wallet
   account new                                 Create a new key and add it to wallet
   account update [<uuid>|<address> , ... ]    Decrypt and re-encrypt keys
   account import [<uuid>|<file>|<secret-hex>] Import keys from given source and place in wallet
   wallet import <file>                        Import a presale wallet

CLIENT MODE (default):
  --mainnet                               Use the main network protocol
  --ropsten                               Use the Ropsten testnet
  --test                                  Testing mode; disable PoW and provide test rpc interface
  --config <file>                         Configure specialised blockchain using given JSON information
                                          
  --ipc                                   Enable IPC server (default: on)
  --ipcpath <path>                        Set .ipc socket path (default: data directory)
  --no-ipc                                Disable IPC server
  --admin <password>                      Specify admin session key for JSON-RPC (default: auto-generated and printed at start-up)
  -K [ --kill ]                           Kill the blockchain first. This will remove all blocks and state.
  -R [ --rebuild ]                        Rebuild the blockchain from the existing database. This involves reimporting all blocks and will probably take a 
                                          while.
  --rescue                                Attempt to rescue a corrupt database
                                          
  --import-presale <file>                 Import a pre-sale key; you'll need to specify the password to this key
  -s [ --import-secret ] <secret>         Import a secret key into the key store
  -S [ --import-session-secret ] <secret> Import a secret session into the key store
  --master <password>                     Give the master password for the key store; use --master "" to show a prompt
  --password <password>                   Give a password for a private key
                                          
CLIENT TRANSACTING:
  --ask <wei>            Set the minimum ask gas price under which no transaction will be mined (default: 20000000000)
  --bid <wei>            Set the bid gas price to pay for transactions (default: 20000000000)
  --unsafe-transactions  Allow all transactions to proceed without verification; EXTREMELY UNSAFE
                         
CLIENT NETWORKING:
  -b [ --bootstrap ]              Connect to the default Ethereum peer servers (default unless --no-discovery used)
  --no-bootstrap                  Do not connect to the default Ethereum peer servers (default only when --no-discovery is used)
  -x [ --peers ] <number>         Attempt to connect to a given number of peers (default: 11)
  --peer-stretch <number>         Give the accepted connection multiplier (default: 7)
  --public-ip <ip>                Force advertised public IP to the given IP (default: auto)
  --listen-ip <ip>(:<port>)       Listen on the given IP for incoming connections (default: 0.0.0.0)
  --listen <port>                 Listen on the given port for incoming connections (default: 30303)
  -r [ --remote ] <host>(:<port>) Connect to the given remote host (default: none)
  --port <port>                   Connect to the given remote port (default: 30303)
  --network-id <n>                Only connect to other hosts with this network id
  --allow-local-discovery         Include local addresses in the discovery process. Used for testing purposes.
  --peerset <list>                Comma delimited list of peers; element format: type:enode://publickey@ipAddress[:port[?discport=port]]
                                          Types:
                                          default     Attempt connection when no other peers are available and pinning is disabled
                                          required    Keep connected at all times
                                  
                                          Ports:
                                          The first port argument is the tcp port used for direct communication among peers. If the second port
                                          argument isn't supplied, the first port argument will also be the udp port used for node discovery.
                                          If neither the first nor second port arguments are supplied, a default port of 30303 will be used for
                                          both peer communication and node discovery.
  --no-discovery                  Disable node discovery; implies --no-bootstrap
  --pin                           Only accept or connect to trusted peers

CLIENT MINING:
  -a [ --address ] <addr>         Set the author (mining payout) address (default: auto)
  -m [ --mining ] <on/off/number> Enable mining; optionally for a specified number of blocks (default: off)
  --extra-data arg                Set extra data for the sealed blocks

BENCHMARKING MODE:
  -M [ --benchmark ]           Benchmark for mining and exit
  --benchmark-warmup <seconds> Set the duration of warmup for the benchmark tests (default: 3)
  --benchmark-trial <seconds>  Set the duration for each trial for the benchmark tests (default: 3)
  --benchmark-trials <n>       Set the number of trials for the benchmark tests (default: 5)

MINING CONFIGURATION:
  -C [ --cpu ]                 When mining, use the CPU
  -t [ --mining-threads ] <n>  Limit number of CPU/GPU miners to n (default: use everything available on selected platform)
  --current-block <n>          Let the miner know the current block number at configuration time. Will help determine DAG size and required GPU memory
  --disable-submit-hashrate    When mining, don't submit hashrate to node
                               
IMPORT/EXPORT MODES:
  -I [ --import ] <file>      Import blocks from file
  -E [ --export ] <file>      Export blocks to file
  --from <n>                  Export only from block n; n may be a decimal, a '0x' prefixed hash, or 'latest'
  --to <n>                    Export only to block n (inclusive); n may be a decimal, a '0x' prefixed hash, or 'latest'
  --only <n>                  Equivalent to --export-from n --export-to n
  --format <binary/hex/human> Set export format
  --dont-check                Prevent checking some block aspects. Faster importing, but to apply only when the data is known to be valid
  --download-snapshot <path>  Download Parity Warp Sync snapshot data to the specified path
  --import-snapshot <path>    Import blockchain and state data from the Parity Warp Sync snapshot
                              
DATABASE OPTIONS:
  --db <name> (=leveldb)                     Select database implementation. Available options are: leveldb, memorydb.
  --db-path <path> (=/Users/louis/.ethereum) Database path (for non-memory database options)
                                             
VM OPTIONS:
  --vm <name>|<path> (=legacy) Select VM implementation. Available options are: interpreter, legacy.
  --evmc  <option>=<value>     EVMC option
                               
LOGGING OPTIONS:
  -v [ --log-verbosity ] <0 - 4>        Set the log verbosity from 0 to 4 (default: 2).
  --log-channels <channel_list>         Space-separated list of the log channels to show (default: show all channels).
                                        Channels: block blockhdr bq chain client debug discov error ethcap exec host impolite info net overlaydb p2pcap peer 
                                        rlpx rpc snap statedb sync timer tq trace vmtrace warn warpcap watch
  --log-exclude-channels <channel_list> Space-separated list of the log channels to hide.
                                        
  --log-vmtrace                         Enable VM trace log (requires log-verbosity 4).
                                        
GENERAL OPTIONS:
  -d [ --data-dir ] <path> Load configuration files and keystore from path (default: /Users/louis/.ethereum)
  -V [ --version ]         Show the version and exit
  -h [ --help ]            Show this help message and exit
                           
