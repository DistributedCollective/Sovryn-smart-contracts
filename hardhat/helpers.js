const deploymentToABI = {
    iDOC: "LoanTokenLogicLM",
    iRBTC: "LoanTokenLogicWrbtc",
    iXUSD: "LoanTokenLogicLM",
    iUSDT: "LoanTokenLogicLM",
    iBPro: "LoanTokenLogicLM",
    iDOCProxy: "LoanTokenLogicProxy",
    iUSDTProxy: "LoanTokenLogicProxy",
    iBProProxy: "LoanTokenLogicProxy",
    iXUSDProxy: "LoanTokenLogicProxy",
    iRBTCProxy: "LoanTokenLogicProxy",
    LoanTokenLogicBeaconLM: "LoanTokenLogicBeacon",
    LoanTokenLogicBeaconWrbtc: "LoanTokenLogicBeacon",
    DoC: "ERC20Detailed",
    ETHs: "ERC20Detailed",
    XUSD: "ERC20Detailed",
    FISH: "ERC20Detailed",
    USDT: "ERC20Detailed",
    BPro: "ERC20Detailed",
    BRZ: "ERC20Detailed",
    MYNT: "ERC20Detailed",
    swapNetwork: "ISovrynSwapNetwork",
    ConverterDOC: "LiquidityPoolV1Converter",
    ConverterBPRO: "LiquidityPoolV2Converter",
    ConverterRIF: "LiquidityPoolV1Converter",
    ConverterUSDT: "LiquidityPoolV2Converter",
    ConverterSOV: "LiquidityPoolV1Converter",
    ConverterXUSD: "LiquidityPoolV1Converter",
    ConverterETHs: "LiquidityPoolV1Converter",
    ConverterMOC: "LiquidityPoolV1Converter",
    ConverterBNBs: "LiquidityPoolV1Converter",
    ConverterFISH: "LiquidityPoolV1Converter",
    "ConverterXUSD-BRZ": "LiquidityPoolV1Converter",
    ConverterMYNT: "LiquidityPoolV1Converter",
    wRBTC_USDT1: "AMMSmartToken",
    wRBTC_USDT2: "AMMSmartToken",
    wRBTC_DOC1: "AMMSmartToken",
    wRBTC_DOC2: "AMMSmartToken",
    wRBTC_BPRO1: "AMMSmartToken",
    wRBTC_BPRO2: "AMMSmartToken",
    wRBTC_SOV: "AMMSmartToken",
    wRBTC_ETH: "AMMSmartToken",
    wRBTC_XUSD: "AMMSmartToken",
    wRBTC_FISH: "AMMSmartToken",
    XUSD_BRZ: "AMMSmartToken",
    wRBTC_MYNT: "AMMSmartToken",
    SOVPoolOracle: "AMMOracle",
    XUSDPoolOracle: "AMMOracle",
    ETHPoolOracle: "AMMOracle",
    MOCPoolOracle: "AMMOracle",
    BNBPoolOracle: "AMMOracle",
    FishPoolOracle: "AMMOracle",
    MYNTPoolOracle: "AMMOracle",
    RIFPoolOracle: "AMMOracle",
    og: "",
    medianizer: "",
    PriceFeedsMOC: "",
    USDTtoUSDTOracleAMM: "",
    BTCtoUSDTOracleAMM: "",
    RSKOracle: "",
    SOVPriceFeedOnProtocol: "",
    MOCPriceFeedsV1Pool: "",
    BProPriceFeeds: "IPriceFeeds",
    SOVPriceFeeds: "IPriceFeeds",
    ETHsPriceFeeds: "IPriceFeeds",
    BNBsPriceFeeds: "IPriceFeeds",
    XUSDPriceFeeds: "IPriceFeeds",
    FISHPriceFeeds: "IPriceFeeds",
    RIFPriceFeeds: "IPriceFeeds",
    MYNTPriceFeeds: "IPriceFeeds",
    CSOV1: "CSOVToken",
    CSOV2: "CSOVToken",
    governorVault: "GovernorValut",
    StakingLogicOld: "",
    StakingLogic: "IStaking",
    StakingLogic2: "IStaking",
    StakingLogic3: "IStaking",
    StakingLogic4: "IStaking",
    StakingLogic5: "IStaking",
    StakingLogic6: "IStaking",
    StakingLogic7: "IStaking",
    OldFeeSharingProxy: "FeeSharingProxy",
    FeeSharingProxy1DayStaking: "FeeSharingProxy",
    GovernorOwner: "GovernorAlpha",
    TimelockOwner: "Timelock",
    GovernorAdmin: "GovernorAlpha",
    TimelockAdmin: "Timelock",
    LiquidityMiningLogic: "LiquidityMining",
    "Aggregator-ETH-RSK": "",
    BridgeRSK: "",
    BridgeETH: "",
    BridgeRSKMultisig: "",
    BridgeETHMultisig: "",
    "RSK-DAIes": "",
    "RSK-USDCes": "",
    "RSK-USDTes": "",
    "RSK-ETHes": "",
    "ETH-DAI": "",
    "ETH-USDC": "",
    "ETH-USDT": "",
    "ETH-eSOV": "",
    WatcherContract: "",
    BFmultisig: "MultiSigWallet",
    AdoptionFund: "DevelopmentFund",
};

module.exports = {
    deploymentToABI,
};
