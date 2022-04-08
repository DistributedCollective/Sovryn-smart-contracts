const { config } = require("./loadConfig");
const fs = require("fs");

/**
 * HH Task which is used to do the healthcheck of MoC Oracle.
 * Peek function will return 2 values.
 * 1. RBTC Price
 * 2. Boolean --> indicating if the price has been updated within the last 10 minutes.
 *
 * This task will write the log to the file.
 *
 * to run the task
 * hh checkMOCOracle --duration 10800000 --oracle-address 0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d --delay 600000 --file-log-path /Users/santosinarpandean/Downloads/moc.txt --network rskSovrynTestnet
 */
task("checkMOCOracle", "Check the stability of MOC oracle")
	.addParam("fileLogPath", "Path of file where log will be written")
	.addParam("oracleAddress", "MOC Oracle address")
	.addOptionalParam("duration", "Duration of the check (in seconds). Default is 1 hour")
	.addOptionalParam("delay", "Delay time for each check iteration (in seconds). Default is 10 minutes")
	.setAction(async (taskArgs) => {
		const { fileLogPath, oracleAddress } = taskArgs;
		const duration = taskArgs.duration || 3600000;
		const delay = taskArgs.delay || 600000;
		console.log("PriceFeedMOC: ", config.contracts().PriceFeedsMOC);

		const PriceFeedsMoC = await ethers.getContractFactory("PriceFeedsMoC");
		const priceFeedsMoC = await PriceFeedsMoC.attach(config.contracts().PriceFeedsMOC);
		console.log("MOC Oracle Address: ", await priceFeedsMoC.mocOracleAddress());

		const MOCOracle = await ethers.getContractAt("Medianizer", oracleAddress);
		let log;

		for (let i = 0; i < duration; i += parseInt(delay)) {
			console.log("i: ", i);
			console.log("Getting price: ", Math.floor(Date.now() / 1000));
			const data = await MOCOracle.peek();
			log = "Getting price: " + Math.floor(Date.now() / 1000) + "\n" + JSON.stringify(data) + "\n\n";
			fs.appendFileSync(fileLogPath, log);
			await sleep(delay);
		}
	});

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
