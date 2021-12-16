pragma solidity >=0.5.0 <0.6.0;

/// @title MYNT market maker contract interface
/// @author Sovryn
/// @notice Provides core functions to place and claim MYNT orders
interface IMyntMarketMaker {
	// solhint-disable-next-line
	function getCollateralToken(address _collateral)
		external
		view
		returns (
			bool,
			uint256,
			uint256,
			uint32,
			uint256
		);

	/**
	 * @notice Open a buy order worth `@tokenAmount(_collateral, _value)`
	 * @param _buyer      The address of the buyer
	 * @param _collateral The address of the collateral token to be spent
	 * @param _value      The amount of collateral token to be spent
	 */
	function openBuyOrder(
		address _buyer,
		address _collateral,
		uint256 _value
	) external payable;

	/**
	 * @notice Open a sell order worth `@tokenAmount(self.token(): address, _amount)` against `_collateral.symbol(): string`
	 * @param _seller     The address of the seller
	 * @param _collateral The address of the collateral token to be returned
	 * @param _amount     The amount of bonded token to be spent
	 */
	function openSellOrder(
		address _seller,
		address _collateral,
		uint256 _amount
	) external;

	/**
	 * @notice Claim the results of `_buyer`'s `_collateral.symbol(): string` buy orders from batch #`_batchId`
	 * @param _buyer      The address of the user whose buy orders are to be claimed
	 * @param _batchId    The id of the batch in which buy orders are to be claimed
	 * @param _collateral The address of the collateral token against which buy orders are to be claimed
	 */
	function claimBuyOrder(
		address _buyer,
		uint256 _batchId,
		address _collateral
	) external;

	/**
	 * @notice Claim the results of `_seller`'s `_collateral.symbol(): string` sell orders from batch #`_batchId`
	 * @param _seller     The address of the user whose sell orders are to be claimed
	 * @param _batchId    The id of the batch in which sell orders are to be claimed
	 * @param _collateral The address of the collateral token against which sell orders are to be claimed
	 */
	function claimSellOrder(
		address _seller,
		uint256 _batchId,
		address _collateral
	) external;

	/**
	 * @notice Claim the investments of `_buyer`'s `_collateral.symbol(): string` buy orders from cancelled batch #`_batchId`
	 * @param _buyer      The address of the user whose cancelled buy orders are to be claimed
	 * @param _batchId    The id of the batch in which cancelled buy orders are to be claimed
	 * @param _collateral The address of the collateral token against which cancelled buy orders are to be claimed
	 */
	function claimCancelledBuyOrder(
		address _buyer,
		uint256 _batchId,
		address _collateral
	) external;

	/**
	 * @notice Claim the investments of `_seller`'s `_collateral.symbol(): string` sell orders from cancelled batch #`_batchId`
	 * @param _seller     The address of the user whose cancelled sell orders are to be claimed
	 * @param _batchId    The id of the batch in which cancelled sell orders are to be claimed
	 * @param _collateral The address of the collateral token against which cancelled sell orders are to be claimed
	 */
	function claimCancelledSellOrder(
		address _seller,
		uint256 _batchId,
		address _collateral
	) external;

	function getCurrentBatchId() external view;
}
