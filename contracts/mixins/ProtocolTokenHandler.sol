pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IERC20.sol";
import "../openzeppelin/Address.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/Ownable.sol";

contract ProtocolTokenHandler is Ownable {
    using Address for address;
    using SafeERC20 for IERC20;

    address public protocolTokenAddress;
    uint256 public requiredCount = 2;
    mapping (address => bool) public isSigner;
    mapping (address => uint256) public userNonce;

    event AddSigner(address indexed signer);
    event RemoveSigner(address indexed signer);
    event SetRequiredCount(uint256 indexed requiredCount);
    event Deposit(address indexed sender, uint256 indexed amount);
    event Withdraw(address indexed caller, address indexed recipient, uint256 indexed amount);

    constructor (address protocolTokenAddress_) public {
        require(protocolTokenAddress_.isContract(), "protocol token address should be contract address");
        protocolTokenAddress = protocolTokenAddress_;
    }

    /** 
     * @param _signer address of signer added
     */
    function addSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "signer address should not be zero address");
        require(!_signer.isContract(), "signer address should not be contract address");
        require(!isSigner[_signer], "signer set");

        isSigner[_signer] = true;

        emit AddSigner(_signer);
    }

    /** 
     * @param _signer address of signer emoved
     */
    function removeSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "signer address should not be zero address");
        require(!_signer.isContract(), "signer address should not be contract address");
        require(isSigner[_signer], "signer not set");

        isSigner[_signer] = false;

        emit RemoveSigner(_signer);
    }

    /**
     * @param requiredCount_ required amount of signs provided by users
     */
    function setRequiredCount(uint256 requiredCount_) public onlyOwner {
        require(requiredCount > 0, "required amount of signs should larger than zero");

        requiredCount = requiredCount_;

        emit SetRequiredCount(requiredCount_);
    }

    /**
     * @dev Before calling this function to deposit protocol tokens, 
     * users need approve this contract to be able to spend or transfer their protocol tokens.
     * @param _amount amount of protocol tokens deposited to this contract
     */
    function deposit(uint256 _amount) public {
        require(_amount > 0, "amount should larger than zero");

        IERC20(protocolTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount);
    }

    /**
     * @param _signs array includes signs from authorized signers, amount/length should equal to requiredCount
     * @param _recipient address of recipient
     * @param _contractAddress addresss of destination contract (should be this contract address)
     * @param _amount amount of tokens to be withdrawed
     * @param _nonce nonce to avoid replay attacks
     * @param _signs array includes signs from authorized signers
     */
    function withdraw(address _recipient, address _contractAddress, uint256 _amount, uint256 _nonce, bytes[] memory _signs) public {
        require(_contractAddress == address(this), "contract address disagreement");
        require(_amount > 0, "amount should larger than zero");

        uint256 balance = IERC20(protocolTokenAddress).balanceOf(address(this));
        require(balance >= _amount, "balance not enough");

        uint256 oldNonce = userNonce[msg.sender];
        require(_nonce > oldNonce, "nonce smaller than last know nonce");
        userNonce[msg.sender] = _nonce;

        bytes32 _hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(_recipient, _contractAddress, _amount, _nonce))));
        
        uint8 v;
        bytes32 r;
        bytes32 s;
        address signer;
        bytes memory sign;
        bytes[] memory signs = new bytes[](requiredCount);
        address[] memory verifiedSigners = new address[](requiredCount);

        signs = _signs;

        for (uint256 i = 0; i < requiredCount; i++) {
            sign = signs[i];
            require(sign.length == 65, "length of sign is wrong");

            assembly {
                r := mload(add(sign, 0x20))
                s := mload(add(sign, 0x40))
                v := add(0x1b, byte(0, mload(add(sign, 0x60))))
            }

            signer = ecrecover(_hash, v, r, s);
            require(isSigner[signer], "signer not authorized");

            for (uint256 q = 0; q < i; q++) {
                require(signer != verifiedSigners[q], "signer verified");
            }
            
            verifiedSigners[i] = signer;
        }

        IERC20(protocolTokenAddress).safeTransfer(
            _recipient,
            _amount
        );

        emit Withdraw(msg.sender, _recipient, _amount);
    }

}