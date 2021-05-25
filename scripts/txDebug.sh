# Credits: Transaction Debug By S4Lsalsoft (https://github.com/DestroyerDarkNess) & Julio Moros
# v2.0

echo " starting...  "

RED='\033[0;31m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
LBlue='\033[0;34m'
NC='\033[0m' # No Color

# In this loop-step te shell code asks the user for the transaction id
ProcessTransaction=true
while $ProcessTransaction; do 

    read -p "Enter the Transaction ID: " Transaction;
    [ -z "$Transaction" ] && echo "" && echo -e "${RED} Transaction ID Is empty ${NC} Please re-enter it." && echo "" || ProcessTransaction=false

done

# In this loop-step the code asks the user for the server which hosts the specific RSK full node
ProcessServer=true
while $ProcessServer; do 

    echo " "
    echo "Enter the server to request: "
    echo " 1) mainnet.sovryn.app"
    echo " 2) testnet.sovryn.app"
	echo " 3) mainnet2.sovryn.app"
    echo " 4) testnet2.sovryn.app"
    #echo " 5) other mainnet node"	
    echo " "


    read -n 1 server;

    case $server in
      1) ServerURL="https://mainnet.sovryn.app/rpc" && ProcessServer=false;;
      2) ServerURL="https://testnet.sovryn.app/rpc" && ProcessServer=false;;
	  3) ServerURL="https://mainnet2.sovryn.app/rpc" && ProcessServer=false;;
	  4) ServerURL="https://testnet2.sovryn.app/rpc" && ProcessServer=false;;
      #5) ServerURL="http://18.190.157.115:4444/" && ProcessServer=false;;
      *) echo "invalid option";;
    esac
    

done

# the screen is cleared and the query to the server starts using curl
clear

JSON_STRING='{"jsonrpc":"2.0","method":"debug_traceTransaction","params":["'"$Transaction"'"],"id":1}'

echo ""
echo -e "Your Transaction Is : ${CYAN} $Transaction ${NC} "
echo ""
echo ""
echo -e "Your Server Is : ${GREEN} $ServerURL ${NC} "
echo ""
echo ""
echo Starting... Please Wait!
echo ""

# this specific script is described at stackoverflow (https://cutt.ly/5bRuIsT)
# the response is stored in the file "output.json" as the data is received
out=$(curl -X POST -H "Content-Type:application/json" --data $JSON_STRING $ServerURL 1> ouput.json )
echo $out

read -p " Process Finished! - Press [Enter] key to exit..."
exit