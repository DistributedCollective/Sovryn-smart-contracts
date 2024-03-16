// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ISafeDepositsSender {
    event Withdraw(address indexed from, address indexed token, uint256 amount);
    event DepositToLockdrop(address indexed token, uint256 amount);
    event WithdrawBalanceFromSafe(address indexed token, uint256 balance);
    event DepositSOVToLockdrop(uint256 amount);
    event Pause();
    event Unpause();
    event Stop();

    function getSafeAddress() external view returns (address);
    function getLockDropAddress() external view returns (address);
    function getSovTokenAddress() external view returns (address);
    function isStopped() external view returns (bool);
    function isPaused() external view returns (bool);

    // @note amount > 0 should be checked by the caller
    function withdraw(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address recipient
    ) external;

    function withdrawAll(address[] calldata tokens, address recipient) external;

    function pause() external;

    function unpause() external;

    function stop() external;

    function sendToLockDropContract(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 sovAmount
    ) external;
}
