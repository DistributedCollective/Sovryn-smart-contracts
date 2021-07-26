To add bpro run
`brownie run add_bpro.py `

To add usdt run
`brownie run add_usdt.py `

The scripts read the addresses of existing contracts from `testnet_contracts.json`, `mainnet_contracts.json` or `swap_test.json` depending on the network. It assumes, the protocol is owned by a multisig if the network is not development.
