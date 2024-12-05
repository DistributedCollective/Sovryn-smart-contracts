## ACCEPTANCE CRITERIA  

* Source [here](https://sovryn.atlassian.net/browse/SOV-4378)  

### Description  

1. Create a PR for review.  
2. Rename `sendDirect` to `utils:send-direct`.  
3. Description of necessary changes to the `utils:send-direct`:  

    a. Rename function properly - you shouldn’t just put the function named `parseFile` in the `utils.js` because it is specific to the direct distribution only. Suggestion: `parseFileForSendDirect` and `parseFileForSendNATIVE`.  
    b. Task `utils:send-direct`:  

    i. Currencies should be added to the external deployment folder as deployment .json files.  
    ii. `dryRun` is a flag, decimals should be variable; see how it is implemented in the `governance:createVestings`.  
    iii. NATIVE currency should be replaced with the `--native` flag.  
    iv. there is no such a thing as `supported currencies list` - you should just get it and throw if no currency deployment found suggesting to add it to the external deployments.  
    v. What if the token is USDT with 6 decimals? see [here](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/bobDevelopment/hardhat/tasks/utils.js#L367) and [here](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/bobDevelopment/hardhat/tasks/utils.js#L371).  
    vi. `multiplier param` should not have a default value - it must be specified explicitly.  
    vii. Create tests for the script - this is critical because it is irreversible.  


4. Add a task `utils:cancel-tx` which is a shortcut of the `utils:replace-tx` case to cancel tx.  

    a. One optional param `--hash`, if not provided then the last tx is being cancelled which is the most common case of cancelling.  
    b. Follow DRY principle - don’t repeat the code - extract it from send-direct to a function.  
    c. how it should work:  
       get the last tx sent and set   
       
       newGasPrice = pendingTx.gasPrice * 1.5;  
       newMaxFee = pendingTx.maxFeePerGas * 1.5  

    d. Create tests.  

5. When reviewed and approved - cherry-pick the tasks into the development branch.  

### Notes  

This task must fork the branch "bobDevelopment" in our core repo.  