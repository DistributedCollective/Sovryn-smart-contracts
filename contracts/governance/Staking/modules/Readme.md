# Staking Modules Guidelines
  
## ModulesProxy based  

Staking Modules implementation utilizes [ModulesProxy](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/7196ecbc4c20a7d215ab0eb1539d44d68a686020/contracts/proxy/modules/Readme.md).  

The StakingModuleProxy contract (ModulesProxy.sol named deployment in hardhat-deploy plugin) is itself a logic for the StakingProxy contract because its the storage is used.  

Therefore current Staking functions call flow:   

    StakingProxy --delegatecall--> StakingModulesProxy --delegatecall--> <function implementation address>.<function selector>

The docs has description and general guidelines on modules and fitting into the Mosules Proxy.  

The generic Staking interface is [IStaking.sol](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/7196ecbc4c20a7d215ab0eb1539d44d68a686020/contracts/governance/Staking/interfaces/IStaking.sol)

The deployment is implemented via the hardhat-deploy plugin - see the [deployment scripts](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/7196ecbc4c20a7d215ab0eb1539d44d68a686020/deployment/deploy). 

### Deploy   
```node
npx hardhat deploy --network <hh network name>
```
with optional `--network <hh network name>` param in the command line 

The deployment scripts are also utilized in the tests e.g.  
```typescript
async function deployNoRegister(_wallets, _provider) {
        await deployments.fixture(["StakingModulesProxy", "StakingModules"]); //using hh deployments script to deploy proxy & modules
}
```
### Add/Replace/Remove modules flow  
    

> Add a module  
  
- Create a module contract 
  - Inherit from generic `StakingStorageShared.sol` and/or other shared functionality as needed
  - Add all the external/public function signatures to be exposed (make callable via the ModulesProxy) by the module returned from the `getFunctionList()` function
- Add the module name to the [getStakingModuleNames()](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/7196ecbc4c20a7d215ab0eb1539d44d68a686020/deployment/helpers/helpers.js#L3)
- Add tests - use the deployment script for instantiation and use fixtures to rollback to the snapshot created at first run
- Deploy the module using the deployment script - `npx hardhat deploy deployments/deploy/20-deploy-StakingModules.js --network <hardhat network name>`
  - Add modules contracts to the <network_name>_contracts.json (testnet_contracts.json, mainnet_contracts.json respectively). *This is to be deprecated in the future
  - It will pick up and redeploy only modified module contracts. If you have other modules changed but want to deploy only specific modules, create another deployment script using the `20-deploy-StakingModules.js` as a sample and run it exclusively  
   
- Validate module

        `StakingModulesProxy(<StakingProxy address>).canAddModule(<module implementation address>)`

- Because Staking contract is governed by [Bitocracy](https://wiki.sovryn.app/en/governance/bitocracy-presentation) it requires a [SIP](https://github.com/DistributedCollective/SIPS) and [SIP creation for voting script](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/8a29f48fc5291b91afcb7b6181020622764f7b6f/scripts/sip/sip_interaction.py) with `StakingModulesProxy(<StakingProxy address>).addModule(<new module address>)` to be executed and launch voting process. If the SIP passes voting, the transaction will be executed and the new module added (functions registered at the StakingProxy storage).  

---
**IT IS VITAL to validate module's functions verification in the SIP script**  

        StakingModulesProxy(<StakingProxy address>).canAddModule(<module implementation address>)

**If the modules being added are invalid then registration transaction will fail if voted for when executed**

---

> Replace a module   

The same steps as adding a module but the function to execute by bitocracy is  
    
    ModulesProxy(<StakingProxy address>).replaceModule(<module address to remove>, <new module address>)

> Remove a module  

Requires only SIP with execution of  

    ModulesProxy(<StakingProxy address>).removeModule(<module address to remove>)

> NOTE  

StakingModulesProxy also has batch processing functions - plural form of the above: `addModules, replaceModules, removeModules`

## Recommendations
    - When extending StakingStorageShared, add storage getters to the module's `getFunctionList()` func list and to the IStaking.sol interface and other ad-hoc interfaces as needed  
    - When changing or creating a new module, keep in mind that modules can be replaced or removed completely to avoid a mess with the registered functions to keep modules functionality consistently and clearly bound to a module contract
    - modules: how to add contract, `function getFunctionList() external pure returns (bytes4[] memory)`- list all functions, add functions signatures to the generic IStaking.sol to be accessible from the scripts 

