import core from '@actions/core'
import github from '@actions/github'
import tc from '@actions/tool-cache'
import { getConfig, type Version } from './config'
import main from './main'

main().catch(err => {
    core.setFailed(err)
    process.exit(1)
})
