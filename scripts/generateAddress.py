import secrets
import web3

def generate_addr(prefix):
    found = False
    prefix = prefix.upper()
    print("Looking for address with prefix = ", prefix, "...")
    prefix = "0X"+prefix.upper()
    while not found:
        private_key = "0x" + secrets.token_hex(32)
        acct = web3.Account.from_key(private_key)
        found = acct.address.upper().startswith(prefix)
    
    print ("PK DO NOT SHARE:", private_key)
    print("Address:", acct.address)

#if __name__=="__main__":
def main():
    #generate_addr()
    prefix="03030"
    generate_addr(prefix)
    print("pause")