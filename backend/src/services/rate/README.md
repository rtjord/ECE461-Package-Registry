<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

# ECE46100 - Team 6 Project Repository

## Contributors
* Garrett Phillips
* Nilayah Peter
* Riley Thomas
* Ethan James

## Description
This program evaluates user provided npm modules and github repositories by calculating a number of metric scores.

## Operation
The program is invoked using "./run [MODE]". There are 3 different operation modes for this program:
1. install: this command must be run before a URL file is inputted
2. &lt;URL_FILE&gt;: this argument is a string containing the filepath to a file containing a series of URLs for each module to be evaluated by the program
3. test: outputs results of running the test suite

## Executing program
#### Install:
    ./run install
#### URL_FILE:
    ./run SampleURLFile.txt

#### Test:
    ./run test

## File Example
### SampleURLFile.txt
    https://github.com/cloudinary/cloudinary_npm
    https://www.npmjs.com/package/express
    https://github.com/nullivex/nodist
    https://github.com/lodash/lodash
    https://www.npmjs.com/package/browserify
    https://github.com/phillips302/ECE461
