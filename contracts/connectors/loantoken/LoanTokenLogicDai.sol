/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStandard.sol";
import "../../interfaces/IChai.sol";

/**
 * @title Loan Token Logic DAI contract.
 *
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the logic of DAI token. More info at:
 *   https://docs.makerdao.com/smart-contract-modules/rates-module
 * */
contract LoanTokenLogicDai is LoanTokenLogicStandard {
	/// @dev Base for DAI maths
	uint256 constant RAY = 10**27;

	/// @notice Mainnet hardcoded token instance addresses.
	/*IChai public constant chai = IChai(0x06AF07097C9Eeb7fD685c692751D5C66dB49c215);
    IPot public constant pot = IPot(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);
    IERC20 public constant dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);*/

	/// @notice Kovan hardcoded token instance addresses.
	IChai public constant chai = IChai(0x71DD45d9579A499B58aa85F50E5E3B241Ca2d10d);
	IPot public constant pot = IPot(0xEA190DBDC7adF265260ec4dA6e9675Fd4f5A78bb);
	IERC20 public constant dai = IERC20(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa);

	/* Public functions */

	/**
	 * @notice Wrapper for _mintToken w/ CHAI flag true.
	 * */
	function mintWithChai(address receiver, uint256 depositAmount) external nonReentrant returns (uint256 mintAmount) {
		return
			_mintToken(
				receiver,
				depositAmount,
				true /// withChai
			);
	}

	/**
	 * @notice Wrapper for _mintToken w/ CHAI flag false.
	 * */
	function mint(address receiver, uint256 depositAmount) external nonReentrant returns (uint256 mintAmount) {
		return
			_mintToken(
				receiver,
				depositAmount,
				false /// withChai
			);
	}

	/**
	 * @notice Wrapper for _burnToken w/ CHAI flag true.
	 * */
	function burnToChai(address receiver, uint256 burnAmount) external nonReentrant returns (uint256 chaiAmountPaid) {
		return
			_burnToken(
				burnAmount,
				receiver,
				true /// toChai
			);
	}

	/**
	 * @notice Wrapper for _burnToken w/ CHAI flag false.
	 * */
	function burn(address receiver, uint256 burnAmount) external nonReentrant returns (uint256 loanAmountPaid) {
		return
			_burnToken(
				burnAmount,
				receiver,
				false /// toChai
			);
	}

	/**
	 * @notice Ask for a flash loan.
	 *
	 * @dev Flash Loans are the first uncollateralized loan option in DeFi.
	 * Flash Loans enable you to borrow instantly and easily, no collateral
	 * needed provided that the liquidity is returned to the pool within
	 * one transaction block.
	 * */
	function flashBorrow(
		uint256 borrowAmount,
		address borrower,
		address target,
		string calldata signature,
		bytes calldata data
	) external payable nonReentrant returns (bytes memory) {
		require(borrowAmount != 0, "38");

		_checkPause();

		_settleInterest();

		_dsrWithdraw(borrowAmount);

		IERC20 _dai = _getDai();

		/// Save before balances.
		uint256 beforeEtherBalance = address(this).balance.sub(msg.value);
		uint256 beforeAssetsBalance = _dai.balanceOf(address(this));

		/// Lock totalAssetSupply for duration of flash loan.
		_flTotalAssetSupply = _underlyingBalance().add(totalAssetBorrow());

		/// Transfer assets to calling contract.
		require(_dai.transfer(borrower, borrowAmount), "39");

		bytes memory callData;
		if (bytes(signature).length == 0) {
			callData = data;
		} else {
			callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
		}

		/// Arbitrary call.
		(bool success, bytes memory returnData) =
			arbitraryCaller.call.value(msg.value)(
				abi.encodeWithSelector(
					0xde064e0d, /// sendCall(address,bytes)
					target,
					callData
				)
			);
		require(success, "call failed");

		/// Unlock totalAssetSupply
		_flTotalAssetSupply = 0;

		/// Verifies return of flash loan.
		require(address(this).balance >= beforeEtherBalance && _dai.balanceOf(address(this)) >= beforeAssetsBalance, "40");

		_dsrDeposit();

		return returnData;
	}

	/**
	 * @notice Borrow funds from the pool.
	 * The underlying loan token may not be used as collateral.
	 *
	 * @dev ***** NOTE: Reentrancy is allowed here to allow flashloan use cases *****
	 *
	 * @param loanId The ID of the loan, 0 for a new loan.
	 * @param withdrawAmount The amount to be withdrawn (actually borrowed).
	 * @param initialLoanDuration The duration of the loan in seconds.
	 *   If the loan is not paid back until then, it'll need to be rolled over.
	 * @param collateralTokenSent The amount of collateral tokens provided by the user.
	 *   (150% of the withdrawn amount worth in collateral tokens).
	 * @param collateralToken The address of the token to be used as
	 *   collateral. Cannot be the loan token address.
	 * @param borrower The one paying for the collateral.
	 * @param receiver The one receiving the withdrawn amount.
	 *
	 * @return New principal and new collateral added to loan.
	 * */
	function borrow(
		bytes32 loanId, /// 0 if new loan.
		uint256 withdrawAmount,
		uint256 initialLoanDuration, /// Duration in seconds.
		uint256 collateralTokenSent, /// If 0, loanId must be provided; any rBTC sent must equal this value.
		address collateralToken, /// If address(0), this means rBTC and rBTC must be sent with the call or loanId must be provided.
		address borrower,
		address receiver,
		bytes memory /// loanDataBytes: arbitrary order data (for future use).
	)
		public
		payable
		returns (
			uint256,
			uint256 /// Returns new principal and new collateral added to loan.
		)
	{
		(uint256 newPrincipal, uint256 newCollateral) =
			super.borrow(
				loanId,
				withdrawAmount,
				initialLoanDuration,
				collateralTokenSent,
				collateralToken,
				borrower,
				receiver,
				"" /// loanDataBytes
			);

		_dsrDeposit();

		return (newPrincipal, newCollateral);
	}

	/**
	 * @notice Borrow and immediately get into a position.
	 *
	 * @dev ***** NOTE: Reentrancy is allowed here to allow flashloan use cases *****
	 *
	 * Trading on margin is used to increase an investor's buying power.
	 * Margin is the amount of money required to open a position, while
	 * leverage is the multiple of exposure to account equity.
	 *
	 * Leverage allows you to trade positions LARGER than the amount
	 * of money in your trading account. Leverage is expressed as a ratio.
	 *
	 * When trading on margin, investors first deposit some token that then
	 * serves as collateral for the loan, and then pay ongoing interest
	 * payments on the money they borrow.
	 *
	 * Margin trading = taking a loan and swapping it:
	 * In order to open a margin trade position,
	 *  1.- The user calls marginTrade on the loan token contract.
	 *  2.- The loan token contract provides the loan and sends it for processing
	 *    to the protocol proxy contract.
	 *  3.- The protocol proxy contract uses the module LoanOpening to create a
	 *    position and swaps the loan tokens to collateral tokens.
	 *  4.- The Sovryn Swap network looks up the correct converter and swaps the
	 *    tokens.
	 * If successful, the position is being held by the protocol proxy contract,
	 * which is why positions need to be closed at the protocol proxy contract.
	 *
	 * @param loanId The ID of the loan, 0 for a new loan.
	 * @param leverageAmount The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.
	 * @param loanTokenSent The number of loan tokens provided by the user.
	 * @param collateralTokenSent The amount of collateral tokens provided by the user.
	 * @param collateralToken The token address of collateral.
	 * @param trader The account that performs this trade.
	 *
	 * @return New principal and new collateral added to trade.
	 * */
	function marginTrade(
		bytes32 loanId, /// 0 if new loan
		uint256 leverageAmount, /// Expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5).
		uint256 loanTokenSent,
		uint256 collateralTokenSent,
		address collateralToken,
		address trader,
		bytes memory loanDataBytes /// Arbitrary order data.
	)
		public
		payable
		returns (
			uint256,
			uint256 /// Returns new principal and new collateral added to trade.
		)
	{
		(uint256 newPrincipal, uint256 newCollateral) =
			super.marginTrade(loanId, leverageAmount, loanTokenSent, collateralTokenSent, collateralToken, trader, loanDataBytes);

		_dsrDeposit();

		return (newPrincipal, newCollateral);
	}

	/* Public View functions */

	/**
	 * @notice The current Maker DSR normalized to APR.
	 * */
	function dsr() public view returns (uint256) {
		return
			_getPot()
				.dsr()
				.sub(RAY)
				.mul(31536000) /// seconds in a year
				.div(10**7);
	}

	/// daiAmount = chaiAmount * chaiPrice
	function chaiPrice() public view returns (uint256) {
		return _rChaiPrice().div(10**9);
	}

	/**
	 * @notice Get interest rate.
	 *
	 * @return Interest that lenders are currently receiving when supplying to
	 * the pool.
	 * */
	function totalSupplyInterestRate(uint256 assetSupply) public view returns (uint256) {
		uint256 supplyRate = super.totalSupplyInterestRate(assetSupply);
		return supplyRate != 0 ? supplyRate : dsr();
	}

	/* Internal functions */

	/**
	 * @notice The low level token mint.
	 *
	 * @param receiver The account getting the minted tokens.
	 * @param depositAmount The amount of underlying tokens provided on the loan.
	 * @param withChai Whether or not to use CHAI (true) or DAI (false).
	 *
	 * @return The amount of loan tokens minted.
	 * */
	function _mintToken(
		address receiver,
		uint256 depositAmount,
		bool withChai
	) internal returns (uint256 mintAmount) {
		require(depositAmount != 0, "17");

		_settleInterest();

		uint256 currentPrice = _tokenPrice(_totalAssetSupply(0));
		uint256 currentChaiPrice;
		IERC20 inAsset;

		if (withChai) {
			inAsset = IERC20(address(_getChai()));
			currentChaiPrice = chaiPrice();
		} else {
			inAsset = IERC20(address(_getDai()));
		}

		require(inAsset.transferFrom(msg.sender, address(this), depositAmount), "18");

		if (withChai) {
			// convert to Dai
			depositAmount = depositAmount.mul(currentChaiPrice).div(10**18);
		} else {
			_dsrDeposit();
		}

		mintAmount = depositAmount.mul(10**18).div(currentPrice);

		uint256 oldBalance = balances[receiver];
		_updateCheckpoints(
			receiver,
			oldBalance,
			_mint(receiver, mintAmount, depositAmount, currentPrice), // newBalance
			currentPrice
		);
	}

	/**
	 * @notice The low level token burn.
	 *
	 * @param burnAmount The amount of loan tokens to redeem.
	 * @param receiver The address of the recipient.
	 * @param toChai Whether or not to use CHAI (true) or DAI (false).
	 *
	 * @return The amount of underlying tokens payed to lender.
	 * */
	function _burnToken(
		uint256 burnAmount,
		address receiver,
		bool toChai
	) internal returns (uint256 amountPaid) {
		require(burnAmount != 0, "19");

		if (burnAmount > balanceOf(msg.sender)) {
			burnAmount = balanceOf(msg.sender);
		}

		_settleInterest();

		uint256 currentPrice = _tokenPrice(_totalAssetSupply(0));

		uint256 loanAmountOwed = burnAmount.mul(currentPrice).div(10**18);

		amountPaid = loanAmountOwed;

		bool success;
		if (toChai) {
			/// DSR any free DAI in the contract before Chai withdrawal
			_dsrDeposit();

			IChai _chai = _getChai();
			uint256 chaiBalance = _chai.balanceOf(address(this));

			success = _chai.move(address(this), receiver, amountPaid);

			/// Get Chai amount withdrawn.
			amountPaid = chaiBalance.sub(_chai.balanceOf(address(this)));
		} else {
			_dsrWithdraw(amountPaid);
			success = _getDai().transfer(receiver, amountPaid);

			_dsrDeposit();
		}
		require(success, "37"); /// Free liquidity of DAI/CHAI insufficient.

		uint256 oldBalance = balances[msg.sender];
		_updateCheckpoints(
			msg.sender,
			oldBalance,
			_burn(msg.sender, burnAmount, loanAmountOwed, currentPrice), /// newBalance
			currentPrice
		);
	}

	/// sentAddresses[0]: lender
	/// sentAddresses[1]: borrower
	/// sentAddresses[2]: receiver
	/// sentAddresses[3]: manager
	/// sentAmounts[0]: interestRate
	/// sentAmounts[1]: newPrincipal
	/// sentAmounts[2]: interestInitialAmount
	/// sentAmounts[3]: loanTokenSent
	/// sentAmounts[4]: collateralTokenSent
	/**
	 * @notice .
	 *
	 * @param collateralTokenAddress The address of the token to be used as
	 *   collateral. Cannot be the loan token address.
	 * @param sentAddresses The addresses to send tokens: lender, borrower,
	 *   receiver and manager.
	 * @param sentAmounts The amounts to send to each address.
	 * @param withdrawalAmount The amount of tokens to withdraw.
	 *
	 * @return msgValue The amount of rBTC sent minus the collateral on tokens.
	 * */
	function _verifyTransfers(
		address collateralTokenAddress,
		address[4] memory sentAddresses,
		uint256[5] memory sentAmounts,
		uint256 withdrawalAmount
	) internal returns (uint256) {
		_dsrWithdraw(sentAmounts[1]);

		return super._verifyTransfers(collateralTokenAddress, sentAddresses, sentAmounts, withdrawalAmount);
	}

	/**
	 * @notice Calculate the price of CHAI.
	 *
	 * @return The price of CHAI.
	 * */
	function _rChaiPrice() internal view returns (uint256) {
		IPot _pot = _getPot();

		uint256 rho = _pot.rho();
		uint256 chi = _pot.chi();
		if (now > rho) {
			chi = rmul(rpow(_pot.dsr(), now - rho, RAY), chi);
		}

		return chi;
	}

	/**
	 * @notice Internal deposit.
	 * */
	function _dsrDeposit() internal {
		uint256 localBalance = _getDai().balanceOf(address(this));
		if (localBalance != 0) {
			_getChai().join(address(this), localBalance);
		}
	}

	/**
	 * @notice Internal withdraw.
	 *
	 * @param _value The amount of DAI to move.
	 * */
	function _dsrWithdraw(uint256 _value) internal {
		uint256 localBalance = _getDai().balanceOf(address(this));
		if (_value > localBalance) {
			_getChai().draw(address(this), _value - localBalance);
		}
	}

	/**
	 * @notice Get the balance of the underlying token.
	 *
	 * @return The amount of the underlying token.
	 * */
	function _underlyingBalance() internal view returns (uint256) {
		return rmul(_getChai().balanceOf(address(this)), _rChaiPrice()).add(_getDai().balanceOf(address(this)));
	}

	/* Owner-Only functions */

	/**
	 * @notice Initialize CHAI.
	 * */
	function setupChai() public onlyOwner {
		/// @dev Approve CHAI to spend any DAI
		_getDai().approve(address(_getChai()), uint256(-1));
		_dsrDeposit();
	}

	/* Internal View functions */

	/**
	 * @notice Next supply interest adjustment.
	 *
	 * @param assetBorrow The amount of tokens to borrow.
	 * @param assetSupply The total amount of tokens on the pool.
	 *
	 * @return The supply interest rate.
	 * */
	function _supplyInterestRate(uint256 assetBorrow, uint256 assetSupply) public view returns (uint256) {
		uint256 _dsr = dsr();
		if (assetBorrow != 0 && assetSupply >= assetBorrow) {
			uint256 localBalance = _getDai().balanceOf(address(this));

			uint256 _utilRate =
				_utilizationRate(
					assetBorrow,
					assetSupply.sub(localBalance) /// DAI not DSR'ed can't be counted
				);
			_dsr = _dsr.mul(SafeMath.sub(100 ether, _utilRate));

			if (localBalance != 0) {
				_utilRate = _utilizationRate(assetBorrow, assetSupply);
			}

			uint256 rate =
				_avgBorrowInterestRate(assetBorrow)
					.mul(_utilRate)
					.mul(SafeMath.sub(10**20, ProtocolLike(sovrynContractAddress).lendingFeePercent()))
					.div(10**20);
			return rate.add(_dsr).div(10**20);
		} else {
			return _dsr;
		}
	}

	/**
	 * @notice Internal getter for CHAI.
	 *
	 * @return The CHAI amount.
	 * */
	function _getChai() internal pure returns (IChai) {
		return chai;
	}

	/**
	 * @notice Internal getter for POT.
	 *
	 * @return The POT amount.
	 * */
	function _getPot() internal pure returns (IPot) {
		return pot;
	}

	/**
	 * @notice Internal getter for DAI.
	 *
	 * @return The DAI amount.
	 * */
	function _getDai() internal pure returns (IERC20) {
		return dai;
	}

	/**
	 * @notice Multiplication function for DAI maths.
	 *
	 * @dev used for multiplications involving ray's. Precision is lost.
	 * */
	function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
		require(y == 0 || (z = x * y) / y == x);
		z /= RAY;
	}

	/**
	 * @notice Power function for DAI maths.
	 *
	 * @dev rpow is used for exponentiation, is a fixed-point arithmetic
	 * function that raises x to the power n. It is implemented in assembly
	 * as a repeated squaring algorithm. x (and the result) are to be
	 * interpreted as fixed-point integers with scaling factor base. For
	 * example, if base == 100, this specifies two decimal digits of
	 * precision and the normal decimal value 2.1 would be represented
	 * as 210; rpow(210, 2, 100) should return 441 (the two-decimal digit
	 * fixed-point representation of 2.1^2 = 4.41). In the current
	 * implementation, 10^27 is passed for base, making x and the rpow
	 * result both of type ray in standard MCD fixed-point terminology.
	 * */
	function rpow(
		uint256 x,
		uint256 n,
		uint256 base
	) public pure returns (uint256 z) {
		assembly {
			switch x
				case 0 {
					switch n
						case 0 {
							z := base
						}
						default {
							z := 0
						}
				}
				default {
					switch mod(n, 2)
						case 0 {
							z := base
						}
						default {
							z := x
						}
					let half := div(base, 2) /// for rounding.
					for {
						n := div(n, 2)
					} n {
						n := div(n, 2)
					} {
						let xx := mul(x, x)
						if iszero(eq(div(xx, x), x)) {
							revert(0, 0)
						}
						let xxRound := add(xx, half)
						if lt(xxRound, xx) {
							revert(0, 0)
						}
						x := div(xxRound, base)
						if mod(n, 2) {
							let zx := mul(z, x)
							if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) {
								revert(0, 0)
							}
							let zxRound := add(zx, half)
							if lt(zxRound, zx) {
								revert(0, 0)
							}
							z := div(zxRound, base)
						}
					}
				}
		}
	}
}
