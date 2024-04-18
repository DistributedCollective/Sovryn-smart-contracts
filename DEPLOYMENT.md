# Sovryn Protocol Deployment Guidelines

## Overview

To deploy Sovryn protocol, we use hardhat-deployment plugin. 
To deploy run scripts in the [deployment/deployments](./deployment/deployments) folder using hardhat semantic, i.e.  

    npx hardhat deploy --tags "Mutex"

## Deployment details

### Mutex  
Mutex is the contract that should be deployed one of the first because it is the basis for cross-contracts reentrancy protection: [contracts/reentrancy/Mutex.sol](./contracts/reentrancy/Mutex.sol)

    npx hardhat deploy --tags "Mutex"

