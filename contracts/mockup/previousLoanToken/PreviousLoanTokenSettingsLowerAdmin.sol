/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../connectors/loantoken/interfaces/ProtocolSettingsLike.sol";
import "../../connectors/loantoken/AdvancedTokenStorage.sol";

// It is a LoanToken implementation!
contract PreviousLoanTokenSettingsLowerAdmin is AdvancedTokenStorage {
	using SafeMath for uint256;

	// It is important to maintain the variables order so the delegate calls can access sovrynContractAddress

	// ------------- MUST BE THE SAME AS IN LoanToken CONTRACT -------------------
	address public sovrynContractAddress;
	address public wrbtcTokenAddress;
	address internal target_;
	// ------------- END MUST BE THE SAME AS IN LoanToken CONTRACT -------------------

	event SetTransactionLimits(address[] addresses, uint256[] limits);
	event ToggleFunctionPause(string funcId, bool isPaused);

	//@todo check for restrictions in this contract
	modifier onlyAdmin() {
		require(msg.sender == address(this) || msg.sender == owner(), "unauthorized");
		_;
	}

	//@todo add check for double init, idk but init usually can be called only once.
	function init(
		address _loanTokenAddress,
		string memory _name,
		string memory _symbol
	) public onlyOwner {
		loanTokenAddress = _loanTokenAddress;

		name = _name;
		symbol = _symbol;
		decimals = IERC20(loanTokenAddress).decimals();

		initialPrice = 10**18; // starting price of 1
	}

	function() external {
		revert("LoanTokenSettingsLowerAdmin - fallback not allowed");
	}

	function setupLoanParams(LoanParamsStruct.LoanParams[] memory loanParamsList, bool areTorqueLoans) public onlyAdmin {
		bytes32[] memory loanParamsIdList;
		address _loanTokenAddress = loanTokenAddress;

		for (uint256 i = 0; i < loanParamsList.length; i++) {
			loanParamsList[i].loanToken = _loanTokenAddress;
			loanParamsList[i].maxLoanTerm = areTorqueLoans ? 0 : 28 days;
		}

		loanParamsIdList = ProtocolSettingsLike(sovrynContractAddress).setupLoanParams(loanParamsList);
		for (uint256 i = 0; i < loanParamsIdList.length; i++) {
			loanParamsIds[
				uint256(
					keccak256(
						abi.encodePacked(
							loanParamsList[i].collateralToken,
							areTorqueLoans // isTorqueLoan
						)
					)
				)
			] = loanParamsIdList[i];
		}
	}

	function disableLoanParams(address[] calldata collateralTokens, bool[] calldata isTorqueLoans) external onlyAdmin {
		require(collateralTokens.length == isTorqueLoans.length, "count mismatch");

		bytes32[] memory loanParamsIdList = new bytes32[](collateralTokens.length);
		for (uint256 i = 0; i < collateralTokens.length; i++) {
			uint256 id = uint256(keccak256(abi.encodePacked(collateralTokens[i], isTorqueLoans[i])));
			loanParamsIdList[i] = loanParamsIds[id];
			delete loanParamsIds[id];
		}

		ProtocolSettingsLike(sovrynContractAddress).disableLoanParams(loanParamsIdList);
	}

	// These params should be percentages represented like so: 5% = 5000000000000000000
	// rateMultiplier + baseRate can't exceed 100%
	function setDemandCurve(
		uint256 _baseRate,
		uint256 _rateMultiplier,
		uint256 _lowUtilBaseRate,
		uint256 _lowUtilRateMultiplier,
		uint256 _targetLevel,
		uint256 _kinkLevel,
		uint256 _maxScaleRate
	) public onlyAdmin {
		require(_rateMultiplier.add(_baseRate) <= WEI_PERCENT_PRECISION, "curve params too high");
		require(_lowUtilRateMultiplier.add(_lowUtilBaseRate) <= WEI_PERCENT_PRECISION, "curve params too high");

		require(_targetLevel <= WEI_PERCENT_PRECISION && _kinkLevel <= WEI_PERCENT_PRECISION, "levels too high");

		baseRate = _baseRate;
		rateMultiplier = _rateMultiplier;
		lowUtilBaseRate = _lowUtilBaseRate;
		lowUtilRateMultiplier = _lowUtilRateMultiplier;

		targetLevel = _targetLevel; // 80 ether
		kinkLevel = _kinkLevel; // 90 ether
		maxScaleRate = _maxScaleRate; // 100 ether
	}

	/**
	 * @notice Set the pause flag for a function to true or false.
	 *
	 * @dev Combining the hash of "iToken_FunctionPause" string and a function
	 *   selector gets a slot to write a flag for pause state.
	 *
	 * @param funcId The ID of a function, the signature.
	 * @param isPaused true/false value of the flag.
	 *
	 * @dev The function signature is defined as the canonical expression of the
	 *   basic prototype without data location specifier, i.e. the function name
	 *   with the parenthesised list of parameter types. Parameter types are split
	 *   by a single comma - no spaces are used.
	 *   The selector is the first (left, high-order in big-endian) four bytes of
	 *   the Keccak-256 (SHA-3) hash of the signature of the function.
	 * */
	function toggleFunctionPause(
		string memory funcId, /// Example: "mint(uint256,uint256)" ,i.e. function signature.
		bool isPaused
	) public onlyAdmin {
		bytes32 slot =
			keccak256(
				abi.encodePacked(
					bytes4(keccak256(abi.encodePacked(funcId))), /// Function selector.
					uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2) /// keccak256("iToken_FunctionPause")
				)
			);
		assembly {
			sstore(slot, isPaused)
		}

		emit ToggleFunctionPause(funcId, isPaused);
	}

	/**
	 * sets the transaction limit per token address
	 * @param addresses the token addresses
	 * @param limits the limit denominated in the currency of the token address
	 * */
	function setTransactionLimits(address[] memory addresses, uint256[] memory limits) public onlyOwner {
		require(addresses.length == limits.length, "mismatched array lengths");
		for (uint256 i = 0; i < addresses.length; i++) {
			transactionLimit[addresses[i]] = limits[i];
		}
		emit SetTransactionLimits(addresses, limits);
	}
}
