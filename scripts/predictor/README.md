# WHAT IS THIS SCRIPT SET FOR?

This set of scripts is intended to help devs to find out if the contracts of a given commit / branch in a repo will reproduce exactly the contracts deployed in the blockchain.
These scripts are categorized into four .js files for convenient separate execution.
This can be used as a tool to predict if the contract code in certain repo / branch / commit will verify in a block explorer.

## Scripts and JSON Files

The folder ./scripts/predictor have four .js files and may have several .json files, but one them is invariant: contract_config.json

These scripts will work only provided that there exist a folder in the repo named ./scripts/contractInteraction contentive of the .json files listing all the Sovryn's deployed contracts.

The script files are:

- createJSON.js --> to initialize the dump .json files with the expected format
- findFiles.js --> to complete information in the files created by the former script
- fillJSON.js --> to help to fill dump files when data is provided by hand
- comparator.js --> generate a report based on the info placed in dump files, and predict if the contracts held in the repo will generate a bytecode congruent with the deployed bytecode.

This scripts are intended to be universal and independent on how old the solidity compiler was the chosen to compile and deploy.

The contract_config.json file will content precise information about the .json files that must be present in the folder ./scripts/contractInteraction, about the network providers and the dump files. Anyone can extend the initial content of the file, but the info must be right or the scripts will fail.

## How to Use These Scripts

1. Clone locally the smart contracts git repo.
2. Install the dependencies as instructed in the RAEADME.md file of that repo.
3. Execute the compiling script. This will generate the needed files and folders to content all the information relative to the compilation included the bytecode for the contracts the in fact were deployed. More info about this can be found [here](https://wiki.sovryn.app/en/technical-documents/API/ApiDoc#h-3-compiling-contracts) for amm repo, and [here](https://wiki.sovryn.app/en/technical-documents/API/ApiDoc#h-3-compile-all-the-contracts-with-hard-hat) for the Sovryn protocol.
4. `./scripts/predictor/contract_config.json` can be edited to extend it. Be ware that the info must be precise or the script may fail with unexpected errors.
5. Check the info in folder `./scripts/contractInteraction` and make sure that at least that the files `mainnet_contracts.json` and `testnet_contracts.json` are present with the relevant info. These files are expected to contain as accurate and complete information as possible, provided by devs who have performed contract deployments in the past.
6. In your local console and from the folder `./scripts/predictor` execute the `createJSON.js` script by:

```
    $ node createJSON
```

After this, files like `m_deployed_compiled.json` mut be present. Be ware that if there was a .json file with that name, this script will overwrite such file.

7. Now we can execute the `findFiles.js` script to fill the dump files with the paths of the files with the conpiled bytecodes:

```
    $ node findFiles
```

8. We can now inspect the modified dump files. It is not expected that all the field have been filled. If there are still missing information we can copy/paste these dump files in other smart contract local repos in which we have performed the compilation scripts. Then we can repeat the step N° 7 in that other repository, and the dump files will be filled with additional information that can only be located in that other repo.
9. We can inspect the modified dump files. If there is still missing information that can be found in the repositories, we can fill such data by hand. We can use the script `fillJSON.js` to automatically copy/paste the new info from the file of one network to its couple. E.g.: if we filled by hand data in `m_deployed_compiled.json`, we can use `fillJSON.js` to copy such data to `t_deployed_compiled.json`. The way to do this is by executing:

```
    $ node fillJSON <file_path_FROM_file> <file_path_TO_file>
```

10. Once we have dump files with the enough information or the expected amount of data, we can now execute the `comparator.js` script. This script will generate a report in the file: `scripts/predictor/report` which will be re-written if present. To execute the comparator we simply do:

```
    $ node comparator
```
