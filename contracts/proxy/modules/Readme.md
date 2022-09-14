# Upgradeable Modules Proxy

ModulesProxy is an upgradeable ownable proxy to Module contracts.  
It is designed as a workaround EIP-170 24k contracts size limit.  

## Implementation  

It stores a registry of { Functions Signature => module (implementation) contract address } in unstructured slots (hash of func signature and nonce key) per function.  
Modules can be added, removed or replace only entirely to avoid a mess of mix of the functions.  

It has protection from clashing of modules and the proxy own functions as well as existing (already registered) functions.

### Modules

Modules should have only one mandatory function 
```typescript
function getFunctionsList() external pure returns (bytes4[] memory) 
```
which returns functions selectors array - used by ModulesProxy at modules' registration.

Deployment flow:
- Deploy Module contract
- Call ModuleProxy.addModule (moduleAddress) (removeModule/replaceModule)
    
NOTE: In hh deployment script, use { contract: "ModuleProxy"} option and proxy name as a parameter.
E.g.  
```typescript
 await deploy("StakingModulesProxy", {
        contract: "ModulesProxy",
        from: deployer,
        args: [],
        log: true,
    });
```

### Best Practices  

- Create a generic interface contract containing all the modules functions declarations e.g. IStaking.sol
- Create ad-hoc interfaces - a subset of a generic interface e.g. for testing purposes IWeghtedStakingMock.sol
- Make abstract all the contracts designed exclusively for inheritance
- Interact with modules via the generic or ad-hoc interfaces only from both contracts and scripts at the ModulesProxy deployment address
