'use strict'

const {join}                     = require('node:path')
const {existsSync, readFileSync} = require('node:fs')

const {extract} = require('../index')

const tarPath     = join(__dirname, 'data/holder.tar')
const destination = join(__dirname, 'data')

extractArchive(tarPath, destination)

/**
 * Extracts all files from a tar archive
 *
 * @param {string} filepath    - path to the tar archive
 * @param {string} destination - path to destination directory
 *
 * @return {void}
 */
function extractArchive(filepath, destination)
{
	if (!existsSync(filepath))
		throw new Error(`cannot find tar archive: ${filepath}`)

	if (!existsSync(destination))
		throw new Error(`cannot open destination folder: ${destination}`)

	const tarball = readFileSync(filepath)

	extract(tarball, destination)
}
