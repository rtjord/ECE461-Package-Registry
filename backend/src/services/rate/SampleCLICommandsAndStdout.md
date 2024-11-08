
# Sample CLI Commands and Output

## MODE 1: Install Dependencies

**Sample Command:**

```bash
$ ./run install
```

**Sample Output (to Stdout):**

```
7 dependencies installed...
```

---

## MODE 2: Rank Modules

**Sample Command:**

```bash
$ ./run <absolute_path_to_file>
```

Where the content enclosed in `<absolute_path_to_file>` is the absolute path to a file containing the list of URLs. For example: `/Users/myUser/IdeaProjects/files/SampleUrlFile.txt`, A sample file named `SampleUrlFile` is also provided.

**Sample Output (to Stdout):**

```json
{"URL":"https://github.com/nullivex/nodist", "NetScore":0.9, "NetScore_Latency": 0.033, "RampUp":0.5, "RampUp_Latency": 0.023, "Correctness":0.7, "Correctness_Latency":0.005, "BusFactor":0.3, "BusFactor_Latency": 0.002, "ResponsiveMaintainer":0.4, "ResponsiveMaintainer_Latency": 0.002, "License":1, "License_Latency": 0.001}
{"URL":"https://www.npmjs.com/package/browserify", "NetScore":0.76, "NetScore_Latency": 0.099, "RampUp":0.5, "RampUp_Latency": 0.003, "Correctness":0.7, "Correctness_Latency":0.019, "BusFactor":0.3, "BusFactor_Latency": 0.024, "ResponsiveMaintainer":0.6, "ResponsiveMaintainer_Latency": 0.042, "License":1, "License_Latency": 0.011}
{"URL":"https://github.com/cloudinary/cloudinary_npm", "NetScore":0.6, "NetScore_Latency": 0.152, "RampUp":0.5, "RampUp_Latency": 0.003, "Correctness":0.7, "Correctness_Latency":0.109, "BusFactor":0.3, "BusFactor_Latency": 0.004, "ResponsiveMaintainer":0.2, "ResponsiveMaintainer_Latency": 0.013, "License":1, "License_Latency": 0.023}
{"URL":"https://github.com/lodash/lodash", "NetScore":0.5, "NetScore_Latency": 0.229, "RampUp":0.5, "RampUp_Latency": 0.062, "Correctness":0.3, "Correctness_Latency":0.042, "BusFactor":0.7, "BusFactor_Latency": 0.084, "ResponsiveMaintainer":0.6, "ResponsiveMaintainer_Latency": 0.039, "License":1, "License_Latency": 0.002}
{"URL":"https://www.npmjs.com/package/express", "NetScore":0, "NetScore_Latency": 0.137,"RampUp":0.5, "RampUp_Latency": 0.002, "Correctness":0.7, "Correctness_Latency":0.076, "BusFactor":0.3, "BusFactor_Latency": 0.004, "ResponsiveMaintainer":0.6, "ResponsiveMaintainer_Latency": 0.009, "License":0, "License_Latency": 0.046}
```

**Note:** If you do not complete an implementation of some metric, please print `-1` as a placeholder so our auto-grader can parse the output. Your project report should discuss such cases. 

For example, if you do not implement `BusFactor`:

```json
{"URL":"https://www.npmjs.com/package/express", "NetScore":0, "NetScore_Latency": 0.133,"RampUp":0.5, "RampUp_Latency": 0.002, "Correctness":0.7, "Correctness_Latency":0.076, "BusFactor":-1, "BusFactor_Latency":-1, "ResponsiveMaintainer":0.6, "ResponsiveMaintainer_Latency": 0.009, "License":0, "License_Latency": 0.046}
```

---

## MODE 3: Run Tests

**Sample Command:**

```bash
$ ./run test
```

**Sample Output (to Stdout):**

```
Total: 10
Passed: 9
Coverage: 90%
9/10 test cases passed. 90% line coverage achieved.
```

**Notes:**

1. The Stdout lines from the test mode should indicate the number of total tests, the number of tests passed, and the test coverage percentage. These lines should begin with "Total", "Passed", and "Coverage" respectively, as shown above.
2. If you have failing test cases, your project report should indicate what behaviors are missing.

---

## Sample Environment Variables

A sample `.env` file has been provided for you. To be able to upload it to Brightspace, we changed the file to a normal text document. Copy the contents to your `.env` file.

You can load the environment variables defined in the `.env` file using the command:

```bash
$ . .env
```

The command `printenv` prints out all the environment variables in your bash terminal. You should confirm that the variables defined in your `.env` file are also returned with this command.

**Sample `printenv` Terminal Output:**

```bash
PATH=/usr/local/opt/openjdk@11/bin:/usr/local/opt/openjdk@11/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
SHELL=/bin/zsh
TERM=xterm-256color
...
GITHUB_TOKEN=ghp_nqp7EaHtK5SKzj5WEA2hRbsq6zeejjnnfuHwR
LOG_LEVEL=1
LOG_FILE=/Users/myUser/IdeaProjects/files/project-1-1.log
```

---

## Log Files

1. The `LOG_FILE` environment variable specifies the absolute path and file name of your log file.
2. Before attempting to write to the log file, you should first confirm that the file exists and create a new file if it doesn't exist.
3. Only the information and results specified above should be printed to stdout. All other information and logs should be printed to the log file.
