const FordwardingContract = artifacts.require("FordwardingContract");
const IERC20 = artifacts.require("IERC20");
const ILoanTokenLogicStandard = artifacts.require("ILoanTokenLogicStandard");
contract("FordwardingContract", (accounts) => {
  let forwardingAddress;
  let forwarding;
  it("should deployed", async () => {
    forwarding = await FordwardingContract.deployed();
    forwardingAddress = forwarding.address;
    // console.log(accounts);
    // console.log(forwarding.address);
    assert.ok(forwarding.address);
  });
  it("should add DOC liquidity to the pool", async () => {
    const docAddress = "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0";
    const erc20 = await IERC20.at(docAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const docAmmLiquidity = "0x497b0517dd24f66c456e93bc0adbb2a2bf159ec4";
    const tokenAmmount = web3.utils.toWei("100", "ether");
    const minReturn = web3.utils.toWei("18", "ether");
    const txReceipt = await forwarding.addLiquidity(
      docAmmLiquidity,
      docAddress,
      tokenAmmount,
      minReturn
    );
    assert.equal(accounts[0], txReceipt.logs[0].args["receiver"]);
  });
  it("should add USDT liquidity to the pool", async () => {
    const usdTAddress = "0x4d5A316d23EBe168D8f887b4447BF8DBfA4901cc";
    const erc20 = await IERC20.at(usdTAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const usdTAmmLiquidity = "0x133eBE9c8bA524C9B1B601E794dF527f390729bF";
    const tokenAmmount = web3.utils.toWei("100", "ether");
    const minReturn = web3.utils.toWei("98", "ether");
    const txReceipt = await forwarding.addLiquidity(
      usdTAmmLiquidity,
      usdTAddress,
      tokenAmmount,
      minReturn
    );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["receiver"],
      "not receiver"
    );
  });
  it("should add BPRO liquidity to the pool", async () => {
    const bPROAddress = "0x4dA7997A819bb46B6758B9102234c289dD2Ad3bf";
    const erc20 = await IERC20.at(bPROAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const bPROAmmLiquidity = "0xe4E467D8B5f61b5C83048d857210678eB86730A4";
    const tokenAmmount = web3.utils.toWei("0.002", "ether");
    const minReturn = web3.utils.toWei("0.001", "ether");
    const txReceipt = await forwarding.addLiquidity(
      bPROAmmLiquidity,
      bPROAddress,
      tokenAmmount,
      minReturn
    );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["receiver"],
      "not receiver"
    );
    //  console.log(txReceipt.logs[0].args);
  });
  it("Lend USDT Token", async () => {
    const usdTAddress = "0x4d5A316d23EBe168D8f887b4447BF8DBfA4901cc";
    const erc20 = await IERC20.at(usdTAddress);

    await erc20.approve(forwardingAddress, await erc20.totalSupply()); //not require here because already approve in 1st unit test
    const iSUSDLoanToken = "0xd1f225BEAE98ccc51c468d1E92d0331c4f93e566";
    const depositAmmount = web3.utils.toWei("28", "ether");
    const txReceipt = await forwarding.depositLendToken(
      iSUSDLoanToken,
      usdTAddress,
      accounts[0],
      depositAmmount
    );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["_receiver"],
      "not receiver"
    );
  });
  it("should deposit  Lend BPRO Token", async () => {
    const BPRPOAddress = "0x4dA7997A819bb46B6758B9102234c289dD2Ad3bf";
    const erc20 = await IERC20.at(BPRPOAddress);

    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const iBPROLoanToken = "0x6226b4B3F29Ecb5f9EEC3eC3391488173418dD5d";
    const depositAmmount = 0.002 * 10 ** 18;
    const txReceipt = await forwarding.depositLendToken(
      iBPROLoanToken,
      BPRPOAddress,
      accounts[0],
      depositAmmount
    );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["_receiver"],
      "not receiver"
    );
  });

  //     CLOSE with Deposit test are not avialble need to change code and add user signature also

  //Same working  with USDT just change docAddress => usdTAddress

  it("margin Trade by user Go short with 4X leverage with DOC", async () => {
    const docAddress = "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0";
    const erc20 = await IERC20.at(docAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const _loanTokenContract = "0xe67Fe227e0504e8e96A34C3594795756dC26e14B";
    const loanId =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const leverageAmount = web3.utils.toWei("3", "ether"); //2X leverage
    const loanTokenSent = 0;
    const collateralTokenSent = web3.utils.toWei("30", "ether");
    const collateralTokenAddress = "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0"; //DOC TOKEN
    const trader = accounts[0];
    const loanDataBytes = "0x";
    const txReceipt = await forwarding.marginTrading(
      _loanTokenContract,
      loanId,
      leverageAmount,
      loanTokenSent,
      collateralTokenSent,
      collateralTokenAddress,
      trader,
      loanDataBytes
    );
    //   console.log("trader", txReceipt.logs[0].args["trader"]); //trader
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["trader"],
      "Trader is not equal"
    );
    //   console.log(
    //     "new principal ",
    //     txReceipt.logs[0].args["newPrinicipal"].toString()
    //   );
    //   console.log(
    //     "new Collateral ",
    //     txReceipt.logs[0].args["newCollateral"].toString()
    //   );
  });
  it("margin Trade by user Go long with 3X leverage with DOC", async () => {
    const DOCAddress = "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0";
    const erc20 = await IERC20.at(DOCAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const _loanTokenContract = "0x74e00A8CeDdC752074aad367785bFae7034ed89f";
    const loanId =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const leverageAmount = web3.utils.toWei("1", "ether"); //2X leverage
    const loanTokenSent = web3.utils.toWei("8", "ether");
    const collateralTokenSent = 0;
    const collateralTokenAddress = "0x0000000000000000000000000000000000000000"; //DOC TOKEN
    const trader = accounts[0];
    const loanDataBytes = "0x";
    const txReceipt = await forwarding.marginTrading(
      _loanTokenContract,
      loanId,
      leverageAmount,
      loanTokenSent,
      collateralTokenSent,
      collateralTokenAddress,
      trader,
      loanDataBytes
    );
    //  console.log("trader", txReceipt.logs[0].args["trader"]); //trader
    // console.log(
    //   "new principal ",
    //   txReceipt.logs[0].args["newPrinicipal"].toString()
    // );
    // console.log(
    //   "new Collateral ",
    //   txReceipt.logs[0].args["newCollateral"].toString()
    // );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["trader"],
      "Trader is not equal"
    );
  });
  it("margin Trade by user Go short with 2X leverage with USDT", async () => {
    const usdTAddress = "0x4d5A316d23EBe168D8f887b4447BF8DBfA4901cc";
    const erc20 = await IERC20.at(usdTAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const _loanTokenContract = "0xe67Fe227e0504e8e96A34C3594795756dC26e14B";
    const loanId =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const leverageAmount = web3.utils.toWei("1", "ether"); //2X leverage
    const loanTokenSent = 0;
    const collateralTokenSent = web3.utils.toWei("12", "ether");
    const collateralTokenAddress = "0x4d5A316d23EBe168D8f887b4447BF8DBfA4901cc"; //USDT TOKEN
    const trader = accounts[0];
    const loanDataBytes = "0x";
    const txReceipt = await forwarding.marginTrading(
      _loanTokenContract,
      loanId,
      leverageAmount,
      loanTokenSent,
      collateralTokenSent,
      collateralTokenAddress,
      trader,
      loanDataBytes
    );
    //console.log("trader", txReceipt.logs[0].args["trader"]); //trader
    // console.log(
    //   "new principal ",
    //   txReceipt.logs[0].args["newPrinicipal"].toString()
    // );
    // console.log(
    //   "new Collateral ",
    //   txReceipt.logs[0].args["newCollateral"].toString()
    //  );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["trader"],
      "Trader is not equal"
    );
  });

  //  depositCollateral() test are not here because there is need to change in contract . Here is how we can change the code in 2nd point
  //  https://docs.google.com/document/d/1PIRfgX-eF0SepjJh2c7-i8wUzSGuHOmKTMMFqgeXnuY/edit

  it("Borrow USDT and provide collateral as DOC", async () => {
    const doCAddress = "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0";
    const erc20 = await IERC20.at(doCAddress);
    await erc20.approve(forwardingAddress, await erc20.totalSupply());
    const _loanTokenContract = "0xd1f225BEAE98ccc51c468d1E92d0331c4f93e566";
    const iloantokenLogic = await ILoanTokenLogicStandard.at(
      _loanTokenContract
    );
    const loanId =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    let withdrawAmmount = web3.utils.toWei("10", "ether");
    const initialLoanDuration = 2419200;
    const collateralTokenAddress = "0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0";
    let collateralTokenSent = (
      await iloantokenLogic.getBorrowAmountForDeposit(
        withdrawAmmount,
        initialLoanDuration,
        collateralTokenAddress
      )
    ).toString();
    console.log("collateralTokenSent", collateralTokenSent);
    const temp = collateralTokenSent;
    collateralTokenSent = withdrawAmmount;
    withdrawAmmount = temp;
    const borrower = accounts[0];
    const receiver = accounts[0];

    const txReceipt = await forwarding.borrow(
      _loanTokenContract,
      loanId,
      withdrawAmmount,
      initialLoanDuration,
      collateralTokenSent,
      collateralTokenAddress,
      borrower,
      receiver,
      "0x"
    );
    console.log("trader", txReceipt.logs[0].args["receiver"]); //trader
    // console.log(
    //   "new principal ",
    //   txReceipt.logs[0].args["newPrinicipal"].toString()
    // );
    // console.log(
    //   "new Collateral ",
    //   txReceipt.logs[0].args["newCollateral"].toString()
    // );
    assert.equal(
      accounts[0],
      txReceipt.logs[0].args["receiver"],
      "Trader is not equal"
    );
  });
});
// SWAP external test and closeWithDeposit test are not return here becaue they need to change
