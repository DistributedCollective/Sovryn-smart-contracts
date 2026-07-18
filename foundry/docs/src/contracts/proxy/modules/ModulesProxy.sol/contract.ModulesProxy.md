# ModulesProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/proxy/modules/ModulesProxy.sol)

**Inherits:**
[ModulesProxyRegistry](/contracts/proxy/modules/ModulesProxyRegistry.sol/contract.ModulesProxyRegistry.md)

ModulesProxy serves as a storage processed by a set of logic contracts - modules
Modules functions are registered in the contract's slots generated per func sig
All the function calls except for own Proxy functions are delegated to
the registered functions
The ModulesProxy is designed as a universal solution for refactorig contracts
reaching a 24K size limit (EIP-170)
Upgradability is implemented at a module level to provide consistency
It does not allow to replace separate functions - only the whole module
meaning that if a module being registered contains other modules function signatures
then these modulea should be replaced completely - all the functions should be removed
to avoid leftovers or accidental replacements and therefore functional inconsistency.
A module is either a new non-overlapping with registered modules
or a complete replacement of another registered module
in which case all the old module functions are unregistered and then
the new module functions are registered
There is also a separate function to unregister a module which unregisters all the functions
There is no option to unregister a subset of module functions - one should use pausable functionality
to achieve this


## Functions
### function

Fallback function delegates calls to modules.
Returns whatever the implementation call returns.
Has a hook to execute before delegating calls
To activate register a module with beforeFallback() function


```solidity
function() external payable;
```

