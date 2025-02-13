SOV-4702
=========  

After checking deeply the [Sovryn-Node](https://github.com/DistributedCollective/Sovryn-Node) git repo, it was found that there is no explicit script or function watching if the total available funds are enough for an aggregated amount of liquidations. As the repo is really old, it only do a test for aggregated estimation of funds in Dollar-On-Chain and rBTC, but it don't take in count other loan positions and an aggregated estimation for rUSDT - which is archaic, but still are old positions active - BPro, XUSD, and DLLR. So, a new separate branch has been created in the same Sovryn-Node repo to develop the calculation functions and take advantage on the alerts the current repo does to Telegram, and integrate an alert system to Discord, as required by SOV-4707.    

***Given the incompatibilities of too old npm dependencies, hardhat packages and node.js version, the script to calculate the required funds for the Watcher contract are being inplemented in the CORE repo.***  

Strategy to get funds needed for liquidations
---------------------------------------------  

1. The script will first fork the RSK mainnet, and register the forking block, which is expected the latest in the moment of running the script.  
2. Using the binary seach algorithm, we will query the protocol's function: `Sovryn.getActiveLoansV2(N,1,false);` we store this value in an array variable.  
3. We will use the binary search algorithm to find the minimum value of N that makes the function return a non empty array. This is the current total amount of active loans.  
4. Once we have found this value, we simulate a sudden price drop of 10% on Bitcoin - as prescribed by the criterias discussed on the [SOV-4702](https://sovryn.atlassian.net/browse/SOV-4702?focusedCommentId=28611) Jira ticket's thread - by manipulating the storage of the `CoinPairPrice` contract from Money On Chain oracle, in the slot 118 : `setStorageAt(CoinPairPriceAddress,118,currentPrice * 0.9);`. This action will also reflect a sudden price drop in the BPro asset.
5. Then we retrieve the total list of active loan positions that result unhealthy by calling the protocol's function: `Sovryn.getActiveLoansV2(0,N,true);` where N is the number discoverd in the step 3. This step may take several minutes, so we are currently optimizing the query method.  
6. We will generate an object listing the assets and the total amounts needed to liquidate unhealthy positions, by aggregating the total amount of `maxLiquidatable` parameter of the position for each asset.    
7. We stop the fork simulation and start another fork in the same block we initiate the script, as in the step 1.  
8. Then, simulate a sudden price rise of 10% on Bitcoin - as prescribed by the criterias discussed on the SOV-4702 Jira ticket's thread - by manipulating the storage of the `CoinPairPrice` contract from Money On Chain oracle, in the slot 118 : `setStorageAt(CoinPairPriceAddress,118,currentPrice * 1.1);`. This action will also reflect a sudden price rise in the BPro asset.  
9. We retrieve the total list of active loan positions that result unhealthy by calling the protocol's function: `Sovryn.getActiveLoansV2(0,N,true);` where N is the number discoverd in the step 3. This step may take several minutes, so we are currently optimizing the query method.  
10. We will generate an object listing the assets and the total amounts needed to liquidate unhealthy positions, by aggregating the total amount of `maxLiquidatable` parameter of the position for each asset.  
11. We will compare the objects obtained in the step 6 and 10 and take the worse case scenario, as the larger total amount of funds needed for each asset to liquidate any unhealthy positions. This is registered in an ultimate object parameter with the needed list os assets that must be available for liquidations on the event of 10% price drop/rise of Bitcoin.  
12. We take the balances of the watcher contract for each asset and compare if there is a lack of funds in any asset.  
13. If there is a lack of funds, we will trigger an alert in a Discord channel.  
