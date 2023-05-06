'use strict'

const {join} = require('path')

const {extractArchive} = require('../index')

const tarPath     = join(__dirname, 'data/holder.tar')
const destination = join(__dirname, 'data')

extractArchive(tarPath, destination)
