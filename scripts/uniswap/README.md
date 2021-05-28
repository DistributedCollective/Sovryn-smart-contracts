# Uniswap Pool Creation

## Files:

### deploy_test_eSOV

Creates a sample SOV token in the network you choose with 100 Million tokens.

### deploy_multisig

Creates a sample multisig using [`MultisigWallet.sol`](../../contracts/multisig/MultiSigWallet.sol)

The multisig owners are taken from either [`eth_testnet_contracts.json`](./eth_testnet_contracts.json) or [`eth_mainnet_contracts.json`](./eth_mainnet_contracts.json) depending on the network.

In testnet, required confirmations from admins are 1 while in mainnet, it is 2.

### deploy_pool_user

Creates a pool from an EOA (Externally Owned Account) in Uniswap.

It assumes that you have enough ETH & token balance for the liquidity in the wallet calling this function.

It checks if the token is approved to be spent by the Uniswap, if not, it will do that.

It then creates the pool in Uniswap.

### deploy_pool

Creates a pool from a multisig in Uniswap.

It assumes either multisig or the user (EOA) calling it has enough ETH and Token in balance.

It checks if the multisig has enough ETH balance, if not it takes the required ETH from EOA.

It then checks if the multisig has enough Token balance, if not, it takes the required Token from EOA.

It then checks if the token is approved to be spent by the Uniswap, if not, it will do that.

It then creates a pool from multisig. (A transaction in multisig is created.)

If checking on testnet, these steps will create the pool. If on mainnet, another user has to call the confirm transaction.

## Steps to Create Pool:

NOTE: Dev experience advised to run the script and to make some edits suggested.

### Mainnet

1. Go to [`eth_mainnet_contracts.json`](./eth_mainnet_contracts.json) and add the values for Multisig Admins. (NOTE: UniswapV2Router02 is taken from [Uniswap's Docs](https://uniswap.org/docs/v2/smart-contracts/router02/#address) and eSOV is taken from [Sovryn Wiki](https://wiki.sovryn.app/en/technical-documents/mainnet-contract-addresses). Please don't change it unless you know what you are doing.)

2. Go to [`brownie-config.yaml`](../../brownie-config.yaml) and edit the `gas_price` under `networks > live` to the current average or fast gas price for Ethereum network.

3. (Optional) Deploying MultiSig: If you don't have a multisig yet, please use the [`deploy_multisig.py`](./deploy_multisig.py) to create a multisig with the parameters taken from [`eth_mainnet_contracts.json`](./eth_mainnet_contracts.json). To create, please run the following command:

```
brownie run scripts/uniswap/deploy_multisig.py --network mainnet
```

4. Once multisig is deployed or known, please update [`eth_mainnet_contracts.json`](./eth_mainnet_contracts.json) to add the new multisig address.

5. Deploying Pool: Create a new pool using [`deploy_pool.py`](./deploy_pool.py). To create, please run the following command:

```
brownie run scripts/uniswap/deploy_pool.py --network mainnet
```

### Testnet (Rinkeby)

1. Go to [`eth_testnet_contracts.json`](./eth_testnet_contracts.json) and add the values for Multisig Admins. (NOTE: UniswapV2Router02 is taken from [Uniswap's Docs](https://uniswap.org/docs/v2/smart-contracts/router02/#address). Please don't change it unless you know what you are doing.)

2. Go to [`brownie-config.yaml`](../../brownie-config.yaml) and edit the `gas_price` under `networks > live` to the current average or fast gas price for Ethereum network. Rinkeby average is somewhere near `1 Gwei`.

3. (Optional) Deploying eSOV: If you don't have a eSOV Token yet, please use the [`deploy_test_eSOV.py`](./deploy_test_eSOV.py) to create a eSOV Token with 100 Million as Token Initial Supply. To create, please run the following command:

```
brownie run scripts/uniswap/deploy_test_eSOV.py --network rinkeby
```

4. Once eSOV is deployed or known, please update [`eth_testnet_contracts.json`](./eth_testnet_contracts.json) to add the new eSOV Token address.

5. (Optional) Deploying MultiSig: If you don't have a multisig yet, please use the [`deploy_multisig.py`](./deploy_multisig.py) to create a multisig with the parameters taken from [`eth_testnet_contracts.json`](./eth_testnet_contracts.json). To create, please run the following command:

```
brownie run scripts/uniswap/deploy_multisig.py --network rinkeby
```

6. Once multisig is deployed or known, please update [`eth_testnet_contracts.json`](./eth_testnet_contracts.json) to add the new multisig address.

7. Deploying Pool: Create a new pool using [`deploy_pool.py`](./deploy_pool.py). To create, please run the following command:

```
brownie run scripts/uniswap/deploy_pool.py --network rinkeby
```

NOTE: If you want to create a pool with EOA, use [`deploy_pool_user.py`](./deploy_pool_user.py). This does not require multisig deployment.

## Possible Errors:

1. Please don't forget to set end points (RPC) for brownie networks (`mainnet` and `rinkeby`). Use your own full node, or any provider like Infura.

2. If the multisig does not have enough tokens or eth to provide liquidity, it is taken from the account which is running it. Please make sure you have enough liquidity present in either your account or multisig.