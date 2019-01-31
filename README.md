# EMnify batch sim issuer changer (Helper Script)
This script shows how you can build custom logic on top of EMnify's comprehensive and easy to use APIs to manage your SIM cards in an automated manner.

It will help you shift a batch of SIM cards from one issuer organisation to another one.

It is build in the programming language Node.js (Java Script) which is an easy language most developers can develop and that runs on all platforms.

The execution of the API requests is being throttled to 2 requests per second in order to not get blocked due to overloading the API.

![Sample image of script usage](/console_output.png)

## Installation

### On Ubuntu or Debian
Open the terminal and type the following
```
sudo apt install git nodejs
git clone git://github.com/EMnify/batch-change-sim-issuer.git ~/batch-change-sim-issuer
cd ~/batch-change-sim-issuer
npm install
sudo npm link
```
> This should download this script, install all dependent modules and install the script so you can use it everywhere. 

## Usage
The script can be executed anywhere in the terminal now by typing `batchChangeSimIssuer` and hitting enter.

It will ask you to select and enter all the relevant information.

What you should prepare in order to use it:
* A CSV file without a header containing a list of all the ICCIDs, IMSIs or SIM IDs you want to move
* An application token of a user of the organisation that is currently the assigned issuer of the sim cards
* The ID of the organisation you want to become the new issuer organisation for the sim cards
