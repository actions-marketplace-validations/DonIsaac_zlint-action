import path from 'path'
import { promises as fs, constants } from 'fs'
import core from '@actions/core'
import gh from '@actions/github'
import tc from '@actions/tool-cache'

import { issueUrl } from './util'

type SemVer = `v${number}.${number}.${number}`
export type Version = 'latest' | SemVer
export interface Config {
    /** Path to zlint binary */
    binary: string
}

export async function getConfig(): Promise<Config> {
    core.startGroup('Configuring ZLint')
    try {
        let binary = core.getInput('binary')
        if (binary) {
            core.info(`Using existing binary at '${binary}'`)
            binary = path.resolve(binary)
            await verifyExistingBinary(binary)
            core.info('Binary found')
            return { binary }
        }

        const version = verifyVersion(core.getInput('version') || 'latest')
        return {
            binary: await downloadBinary(version),
        }
    } finally {
        core.endGroup()
    }
}

async function downloadBinary(version: Version): Promise<string> {
    const { os, arch } = getOsAndArch()
    const downloadPart = version === 'latest'
        ? 'latest/download'
        : `download/${version}`
    const url = `https://github.com/DonIsaac/zlint/releases/${downloadPart}/zlint-${os}-${arch}?source=github-actions`
    core.info(`Downloading ZLint binary from ${url}`)
    const bin = await tc.downloadTool(url)
    await fs.chmod(bin, 0o755)

    // TODO: verify the downloaded binary via github attestation

    return bin
}

function getOsAndArch() {
    const { platform, arch: cpuArch } = process

    let os: string
    switch (platform) {
        case 'win32':
            os = 'windows'
            break
        case 'darwin':
            os = 'macos'
            break
        case 'linux':
            os = 'linux'
            break
        default: {
            const url = issueUrl({
                title: `github actions: OS not supported (${platform}-${cpuArch})`,
            })
            core.setFailed(
                `ZLint does not currently support ${platform}. Please open an issue on github: ${url}`
            )
            process.exit(1)
        }
    }

    let arch: string
    switch (cpuArch) {
        // TODO: is 'arm' ok?
        case 'arm64':
            arch = 'aarch64'
            break
        case 'x64':
            arch = 'x86_64'
            break
        default: {
            const url = issueUrl({
                title: `github actions: CPU arch not supported (${platform}-${cpuArch})`,
            })
            core.setFailed(
                `ZLint does not currently support ${cpuArch}. Please open an issue on github: ${url}`
            )
            process.exit(1)
        }
    }

    return { os, arch }
}

function f() { }
const SEMVER_REGEX = /^v(\d+)\.(\d+)\.(\d+)$/
const isSemVer = (version: string): version is SemVer =>
    SEMVER_REGEX.test(version)
function verifyVersion(version: string): Version {
    core.info(`Verifying version: ${version}`)
    if (version === 'latest') return version

    // add leading `v` if missing
    const firstChar = version.charCodeAt(0)
    const startsWithNumber = firstChar >= 48 && firstChar <= 57
    if (!startsWithNumber) version = `v${version}`
    if (!isSemVer(version)) {
        throw new ConfigError(
            `Invalid version: ${version}. Please use 'v.major.minor.patch' or 'latest'.`
        )
    }

    return version
}

/**
 * Ensure a binary at `binaryPath` exists and is executable by the current user.
 * @param binaryPath Path to the binary to verify. May be relative to the cwd.
 */
async function verifyExistingBinary(binaryPath: string) {
    try {
        const perms = await fs.stat(binaryPath)
        if (!(perms.mode & constants.S_IXUSR)) {
            throw new ConfigError(
                `ZLint binary at '${binaryPath}' is not executable.`
            )
        }
    } catch (e) {
        if (e instanceof ConfigError) throw e

        const error = new ConfigError(
            `Could not find ZLint binary at '${binaryPath}'.`
        )
        error.cause = e
        throw error
    }
}

export class ConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ConfigError'
    }
}
