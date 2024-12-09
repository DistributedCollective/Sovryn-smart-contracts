const fs = require("fs");
const path = require("path");

// Main script
(async () => {
    try {
        // Get the "inputFile" parameter
        const inputFile = process.argv[2];
        if (!inputFile) {
            throw new Error(
                "Missing inputFile parameter. Usage: node file-populator.js <inputFile>"
            );
        }

        // Validate inputFile structure and extract NETWORK
        const inputFileMatch = inputFile.match(/\.\/.*\/(\w+)-tokens\.json$/);
        if (!inputFileMatch) {
            throw new Error(
                "inputFile name does not match the expected pattern: './some-prefix-path/xxx-tokens.json'"
            );
        }
        const NETWORK = inputFileMatch[1];
        const outputDir = `./external/deployments/${NETWORK}Mainnet`;

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`Created directory: ${outputDir}`);
        }

        // Load inputFile content
        const inputData = require(path.resolve(inputFile));

        // Load ERC20.json content
        const ERC20 = require("./ERC20.json");
        const abiArray = ERC20.abi;
        if (!Array.isArray(abiArray)) {
            throw new Error("Invalid ERC20.json file: Missing or invalid 'abi' key.");
        }

        // Process each key in inputFile
        for (const [key, addresses] of Object.entries(inputData)) {
            if (!Array.isArray(addresses) || addresses.length === 0) {
                console.warn(`Skipping ${key} due to invalid addresses array.`);
                continue;
            }

            const outputFilePath = path.join(outputDir, `${key}.json`);

            // Skip if the file already exists
            if (fs.existsSync(outputFilePath)) {
                console.log(`File already exists, skipping: ${outputFilePath}`);
                continue;
            }

            // Prepare the object to write
            const outputData = {
                address: addresses[0].toLowerCase(), // Use the 0th element of the array
                abi: abiArray, // Use the ABI from ERC20.json
            };

            // Write the JSON file
            fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));
            console.log(`File created: ${outputFilePath}`);
        }

        console.log("Processing completed successfully.");
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
