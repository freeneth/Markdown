import styled from 'styled-components'

export function m(...objs) {
    return Object.assign({}, ...objs)
}

export const NonSelectDiv = styled.div`
    user-select: none;
    cursor: default;
`
export const ClickableDiv = styled(NonSelectDiv)`
    cursor: pointer;
`
