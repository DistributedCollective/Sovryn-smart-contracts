pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./ProtocolTokenUser.sol"; 
import "../interfaces/IERC20.sol";
import "../openzeppelin/Address.sol";
import "../openzeppelin/ECDSA.sol";

contract ProtocolTokenHandler is ProtocolTokenUser {
    using Address for address;
    using ECDSA for bytes32;

    uint256 public requiredCount = 2;
    mapping (address => bool) isSigner;
    mapping (uint256 => bool) usedNonces;
    mapping (address => bool) verifiedSigners;

    event AddSigner(address indexed singer);
    event RemoveSigner(address indexed singer);
    event SetRequiredCount(uint256 indexed requiredCount);
    event Deposit(address indexed sender, uint256 indexed amount);
    event Withdraw(address indexed caller, address indexed recipient, uint256 indexed amount);

    function addSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "signer address should not be zero address");
        require(!_signer.isContract(), "signer address should not be contract address");
        require(!isSigner[_signer], "signer set");

        isSigner[_signer] = true;

        emit AddSigner(_signer);
    }

    function removeSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "signer address should not be zero address");
        require(!_signer.isContract(), "signer address should not be contract address");
        require(isSigner[_signer], "signer not set");

        isSigner[_signer] = false;

        emit RemoveSigner(_signer);
    }

    function setRequiredCount(uint256 requiredCount_) public onlyOwner {
        require(requiredCount > 0, "required amount of signs should larger than zero");

        requiredCount = requiredCount_;

        emit SetRequiredCount(requiredCount_);
    }

    /**
     * @dev Before calling this function to deposit protocol tokens, 
     * users need approve this contract to be able to spend or transfer their protocol tokens.    
     */
    function deposit(uint256 _amount) public {
        require(_amount > 0, "amount should larger than zero");

        IERC20(protocolTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        protocolTokenHeld = protocolTokenHeld.add(_amount);

        emit Deposit(msg.sender, _amount);
    }

    /**
     * @param _data the message/data from users to be signed by authorized signers, should include in order: 
     * address of recipient, addresss of destination contract (should be this contract address), amount of tokens to be withdrawed, nounce
     * @param _signs array includes signs from authorized signers, amount/length should equal to requiredCount
     */
    function withdraw(bytes memory _data, bytes[] memory _signs) public {
        _signs = new bytes[](requiredCount);
        bytes32 _hash = keccak256(_data).toEthSignedMessageHash();

        for (uint256 i = 0; i < requiredCount; i++) {
            address signer = _hash.recover(_signs[i]);
            require(isSigner[signer], "signer not authorized");
            require(!verifiedSigners[signer], "signer verified");
            verifiedSigners[signer] = true;
        }

        for (uint256 i = 0; i < requiredCount; i++) {
            verifiedSigners[_hash.recover(_signs[i])] = false;
        }

        (address recipient, address contractAddress, uint256 amount, uint256 nonce) = abi.decode(_data, (address, address, uint256, uint256));

        require(!usedNonces[nonce], "nonce used");
        usedNonces[nonce] = true;

        require(contractAddress == address(this), "contract address disagreement");

        (address _protocolTokenAddress, bool success) = _withdrawProtocolToken(recipient, amount);
        require(_protocolTokenAddress == protocolTokenAddress, "protocol token address disagreement");
        if (success) {
            protocolTokenPaid = protocolTokenPaid.add(amount);
        }

        emit Withdraw(msg.sender, recipient, amount);
    }

}