# hasura-auto-tracker
[![NPM](https://nodei.co/npm/hasura-auto-tracker.png)](https://nodei.co/npm/hasura-auto-tracker/)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)


Configure Hasura to track tables, views and functions using a configuration driven process that fits perfectly into your Continuous Integration or Continuous Delivery piepline.

# What's the big deal?
We all know how awesome Hasura is and how easy it is to fire up the user interface and configure the tracking. But what if you want to control and configure the tracking as part of an automated build, test and deploy cycle?

Hasura can read values from JSON objects stored in SQL tables, but the values are not returned as their most appropraite type, i.e the values are not typed as integers and floats etc.

Also, what if as part of your build process, you start with a clean database, want to inject your test data and run various scripts? You would have to restort to using different tools to configure hasura and then run your scripts.

# hasura-auto-tracker to the rescue!
`hasura-auto-tracker` (HAT) can be used anytime you want to configure the tracking of tables, views and functions, and don't want to interact with a user-interface, i.e. you want to use it as part of a scripted/automated process, or you want to build the code directly into your own tools / apps.

HAT not only configures the tracking, but you can also control the names of realtionships that are created between objects, such as customers and their orders. This means that you can optimise the names of relationships and therefore increase the readbility of your queries. This feature alone is awesome!

Finally, HAT let's you easily create views which can extract values from JSON objects and present them as correctly typed values. So now you can have integers, floats, dates, anything, as a SQL type, instead of just a string.

# Example Folder
You can install HAT as an npm package, or pull the code from github.

Refer to the example folder, and particularly the package.json. You will see a docker-compose file which will create a test database, so you can put HAT through its paces, and you will see ways to run HAT from your own code, or even from the command line.
