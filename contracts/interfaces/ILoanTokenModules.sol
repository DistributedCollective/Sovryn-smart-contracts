pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

interface ILoanTokenModules {
	/** EVENT */
	/// topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
	event Transfer(address indexed from, address indexed to, uint256 value);

	/// topic: 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
	event Approval(address indexed owner, address indexed spender, uint256 value);

	/// topic: 0x628e75c63c1873bcd3885f7aee9f58ee36f60dc789b2a6b3a978c4189bc548ba
	event AllowanceUpdate(address indexed owner, address indexed spender, uint256 valueBefore, uint256 valueAfter);

	/// topic: 0xb4c03061fb5b7fed76389d5af8f2e0ddb09f8c70d1333abbb62582835e10accb
	event Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price);

	/// topic: 0x743033787f4738ff4d6a7225ce2bd0977ee5f86b91a902a58f5e4d0b297b4644
	event Burn(address indexed burner, uint256 tokenAmount, uint256 assetAmount, uint256 price);

	/// topic: 0xc688ff9bd4a1c369dd44c5cf64efa9db6652fb6b280aa765cd43f17d256b816e
	event FlashBorrow(address borrower, address target, address loanToken, uint256 loanAmount);

	/// topic: 0x9bbd2de400810774339120e2f8a2b517ed748595e944529bba8ebabf314d0591
	event SetTransactionLimits(address[] addresses, uint256[] limits);

	event WithdrawRBTCTo(address indexed to, uint256 amount);

	event ToggledFunctionPaused(string functionId, bool prevFlag, bool newFlag);

	/** INTERFACE */

	/** START LOAN TOKEN SETTINGS LOWER ADMIN */
	struct LoanParams {
		/// @dev ID of loan params object.
		bytes32 id;
		/// @dev If false, this object has been disabled by the owner and can't
		///   be used for future loans.
		bool active;
		/// @dev Owner of this object.
		address owner;
		/// @dev The token being loaned.
		address loanToken;
		/// @dev The required collateral token.
		address collateralToken;
		/// @dev The minimum allowed initial margin.
		uint256 minInitialMargin;
		/// @dev An unhealthy loan when current margin is at or below this value.
		uint256 maintenanceMargin;
		/// @dev The maximum term for new loans (0 means there's no max term).
		uint256 maxLoanTerm;
	}

	function setAdmin(address _admin) external;

	function setPauser(address _pauser) external;

	function setupLoanParams(LoanParams[] calldata loanParamsList, bool areTorqueLoans) external;

	function disableLoanParams(address[] calldata collateralTokens, bool[] calldata isTorqueLoans) external;

	function setDemandCurve(
		uint256 _baseRate,
		uint256 _rateMultiplier,
		uint256 _lowUtilBaseRate,
		uint256 _lowUtilRateMultiplier,
		uint256 _targetLevel,
		uint256 _kinkLevel,
		uint256 _maxScaleRate
	) external;

	function toggleFunctionPause(
		string calldata funcId, /// example: "mint(uint256,uint256)"
		bool isPaused
	) external;

	function setTransactionLimits(address[] calldata addresses, uint256[] calldata limits) external;

	function changeLoanTokenNameAndSymbol(string calldata _name, string calldata _symbol) external;

	/** END LOAN TOKEN SETTINGS LOWER ADMIN */

	/** START LOAN TOKEN LOGIC STANDARD */
	function marginTrade(
		bytes32 loanId, /// 0 if new loan
		uint256 leverageAmount, /// Expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5).
		uint256 loanTokenSent,
		uint256 collateralTokenSent,
		address collateralTokenAddress,
		address trader,
		uint256 minReturn, // minimum position size in the collateral tokens
		bytes calldata loanDataBytes /// Arbitrary order data.
	)
		external
		payable
		returns (
			uint256,
			uint256 /// Returns new principal and new collateral added to trade.
		);

	function marginTradeAffiliate(
		bytes32 loanId, // 0 if new loan
		uint256 leverageAmount, // expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5)
		uint256 loanTokenSent,
		uint256 collateralTokenSent,
		address collateralTokenAddress,
		address trader,
		uint256 minReturn, /// Minimum position size in the collateral tokens.
		address affiliateReferrer, /// The user was brought by the affiliate (referrer).
		bytes calldata loanDataBytes /// Arbitrary order data.
	)
		external
		payable
		returns (
			uint256,
			uint256 /// Returns new principal and new collateral added to trade.
		);

	function borrowInterestRate() external view returns (uint256);

	function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);

	function burn(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);

	function checkPause(string calldata funcId) external view returns (bool isPaused);

	function nextBorrowInterestRate(uint256 borrowAmount) external view returns (uint256);

	function borrow(
		bytes32 loanId, /// 0 if new loan.
		uint256 withdrawAmount,
		uint256 initialLoanDuration, /// Duration in seconds.
		uint256 collateralTokenSent, /// If 0, loanId must be provided; any rBTC sent must equal this value.
		address collateralTokenAddress, /// If address(0), this means rBTC and rBTC must be sent with the call or loanId must be provided.
		address borrower,
		address receiver,
		bytes calldata /// loanDataBytes: arbitrary order data (for future use).
	)
		external
		payable
		returns (
			uint256,
			uint256 /// Returns new principal and new collateral added to loan.
		);

	function transfer(address _to, uint256 _value) external returns (bool);

	function transferFrom(
		address _from,
		address _to,
		uint256 _value
	) external returns (bool);

	function setLiquidityMiningAddress(address LMAddress) external;

	function getLiquidityMiningAddress() external view returns (address);

	function getEstimatedMarginDetails(
		uint256 leverageAmount,
		uint256 loanTokenSent,
		uint256 collateralTokenSent,
		address collateralTokenAddress // address(0) means ETH
	)
		external
		view
		returns (
			uint256 principal,
			uint256 collateral,
			uint256 interestRate
		);

	function getDepositAmountForBorrow(
		uint256 borrowAmount,
		uint256 initialLoanDuration, /// Duration in seconds.
		address collateralTokenAddress /// address(0) means rBTC
	) external view returns (uint256 depositAmount);

	function getBorrowAmountForDeposit(
		uint256 depositAmount,
		uint256 initialLoanDuration, /// Duration in seconds.
		address collateralTokenAddress /// address(0) means rBTC
	) external view returns (uint256 borrowAmount);

	function checkPriceDivergence(
		uint256 leverageAmount,
		uint256 loanTokenSent,
		uint256 collateralTokenSent,
		address collateralTokenAddress,
		uint256 minReturn
	) external view;

	function getMaxEscrowAmount(uint256 leverageAmount) external view returns (uint256 maxEscrowAmount);

	function checkpointPrice(address _user) external view returns (uint256 price);

	function assetBalanceOf(address _owner) external view returns (uint256);

	function profitOf(address user) external view returns (int256);

	function tokenPrice() external view returns (uint256 price);

	function avgBorrowInterestRate() external view returns (uint256);

	function supplyInterestRate() external view returns (uint256);

	function nextSupplyInterestRate(uint256 supplyAmount) external view returns (uint256);

	function totalSupplyInterestRate(uint256 assetSupply) external view returns (uint256);

	function loanTokenAddress() external view returns (address);

	function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount) external view returns (uint256, uint256);

	function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external;

	/** START LOAN TOKEN BASE */
	function initialPrice() external view returns (uint256);

	/** START LOAN TOKEN LOGIC LM */
	function mint(
		address receiver,
		uint256 depositAmount,
		bool useLM
	) external returns (uint256 minted);

	function burn(
		address receiver,
		uint256 burnAmount,
		bool useLM
	) external returns (uint256 redeemed);

	/** START LOAN TOKEN LOGIC WRBTC */
	function mintWithBTC(address receiver, bool useLM) external payable returns (uint256 mintAmount);

	function burnToBTC(
		address receiver,
		uint256 burnAmount,
		bool useLM
	) external returns (uint256 loanAmountPaid);

	/** START LOAN TOKEN LOGIC STORAGE */
	function liquidityMiningAddress() external view returns (address);

	function name() external view returns (string memory);

	function symbol() external view returns (string memory);

	/** START ADVANCED TOKEN */
	function approve(address _spender, uint256 _value) external returns (bool);

	/** START ADVANCED TOKEN STORAGE */
	function allowance(address _owner, address _spender) external view returns (uint256);

	function balanceOf(address _owner) external view returns (uint256);

	function totalSupply() external view returns (uint256);
}
