/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found at beforeEach hook, redeploying token,
 *  protocol and loan on every test.
 *
 * Total time elapsed: 6.2s
 * After optimization: 4.6s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Also tried to use the loan_pool_setup() function but couldn't due to the
 *   custom pool parameters test is using.
 */

const { assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, constants, ether } = require("@openzeppelin/test-helpers");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenLogicWrbtc,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	getPriceFeeds,
	getSovryn,
	decodeLogs,
	getSOV,
} = require("../Utils/initializer.js");

contract("LoanSettings", (accounts) => {
	let lender;
	let SUSD; // underlying token
	let WRBTC; // collateral token
	let sovryn, loanToken;
	let loanParams;

	async function deploymentAndInitFixture(_wallets, _provider) {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		/// @dev Not included in initializer.js
		await sovryn.setFeesController(lender);

		loanTokenLogicWrbtc = await getLoanTokenLogicWrbtc();

		loanToken = await getLoanToken(loanTokenLogicWrbtc, lender, sovryn, WRBTC, SUSD);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

		await WRBTC.mint(sovryn.address, ether("500"));

		loanParams = {
			id: "0x0000000000000000000000000000000000000000000000000000000000000000",
			active: false,
			owner: constants.ZERO_ADDRESS,
			loanToken: SUSD.address,
			collateralToken: WRBTC.address,
			minInitialMargin: ether("50"),
			maintenanceMargin: ether("15"),
			maxLoanTerm: "2419200",
		};

		let tx = await sovryn.setupLoanParams([Object.values(loanParams)]);
		loanParamsId = tx.logs[1].args.id;
	}

	before(async () => {
		[lender, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("test LoanSettings", async () => {
		it("test setup removeLoanParams", async () => {
			let loanParamsAfter = (await sovryn.getLoanParams([loanParamsId]))[0];

			assert(loanParamsAfter["id"] != "0x0");
			assert(loanParamsAfter["active"]);
			assert(loanParamsAfter["owner"] == lender);
			assert(loanParamsAfter["loanToken"] == SUSD.address);

			await expectRevert(sovryn.disableLoanParams([loanParamsId], { from: accounts[0] }), "unauthorized owner");

			await sovryn.disableLoanParams([loanParamsId], { from: lender });
			assert((await sovryn.getLoanParams([loanParamsId]))[0]["id"] != "0x0");
		});

		it("test disableLoanParams", async () => {
			await sovryn.disableLoanParams([loanParamsId], { from: lender });

			let loanParamsAfter = (await sovryn.getLoanParams([loanParamsId]))[0];

			assert(loanParamsAfter["id"] != "0x0");
			assert(loanParamsAfter["active"] == false); // false because we disabled Loan Param just before
			assert(loanParamsAfter["owner"] == lender);
			assert(loanParamsAfter["loanToken"] == SUSD.address);
			assert(loanParamsAfter["collateralToken"] == WRBTC.address);
			assert(loanParamsAfter["minInitialMargin"] == ether("50"));
			assert(loanParamsAfter["maintenanceMargin"] == ether("15"));
			assert(loanParamsAfter["maxLoanTerm"] == "2419200");
		});

		it("test getLoanParams", async () => {
			let loanParamsAfter = (await sovryn.getLoanParams([loanParamsId]))[0];

			assert(loanParamsAfter["id"] != "0x0");
			assert(loanParamsAfter["active"]);
			assert(loanParamsAfter["owner"] == lender);
			assert(loanParamsAfter["loanToken"] == SUSD.address);
			assert(loanParamsAfter["collateralToken"] == WRBTC.address);
			assert(loanParamsAfter["minInitialMargin"] == ether("50"));
			assert(loanParamsAfter["maintenanceMargin"] == ether("15"));
			assert(loanParamsAfter["maxLoanTerm"] == "2419200");
		});

		it("test getLoanParamsList", async () => {
			let loanParamsList = await sovryn.getLoanParamsList(lender, 0, 1);
			assert(loanParamsList[0] == loanParamsId);
		});

		it("test getTotalPrincipal", async () => {
			let totalPrincipal = await sovryn.getTotalPrincipal(lender, SUSD.address);
			assert(totalPrincipal == 0);
		});
	});
});
