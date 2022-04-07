const { config } = require("./loadConfig");

task("checkMOCOracle", "Check the stability of MOC oracle")
  .addParam("oracleAddress", "MOC Oracle address")
  .addOptionalParam("duration", "Duration of the check (in seconds). Default is 1 hour")
  .addOptionalParam("delay", "Delay time for each check iteration (in seconds). Default is 10 seconds")
  .setAction(async (taskArgs) => {
    const mocOracleAddress = taskArgs.oracleAddress;
    const duration = taskArgs.duration || 3600000;
    const delay = taskArgs.delay || 10000;
    console.log("PriceFeedMOC: ", config.contracts().PriceFeedsMOC);

    const PriceFeedsMoC = await ethers.getContractFactory("PriceFeedsMoC");
    const priceFeedsMoC = await PriceFeedsMoC.attach(config.contracts().PriceFeedsMOC);
    console.log("MOC Oracle Address: ",await priceFeedsMoC.mocOracleAddress());

    const MOCOracle = await ethers.getContractAt("Medianizer", mocOracleAddress);

    for(let i = 0; i < duration; i++) {
      console.log("Getting price: ", new Date());

      console.log(await MOCOracle.peek());
      await sleep(delay);
    }
  })

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// hh checkMOCOracle --duration 10800000 --network rskSovrynTestnet --oracle-address 0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d --delay 600000