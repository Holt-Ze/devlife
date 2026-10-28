import { PullCount } from '@/config'
import { useModeChoose } from '@remake/hooks'
import { Text, Box } from '@/components'
import { useSelect } from '@/hooks/select'
import { useAppFocus } from '@/context/focus'
import { colors } from '@/style'

export function Mode() {
    const [Mode, choose] = useModeChoose()
    const { isFocused } = useAppFocus()
    const selected = useSelect(
        [
            { key: 'c', action: () => choose(Mode.Classic) },
            { key: 'e', action: () => choose(Mode.Celebrity) },
        ],
        { isActive: isFocused('main') },
    )
    const csm = selected === 0
    return (
        <Box flexDirection="column" width={26}>
            <Box
                flexDirection="column"
                borderStyle="singleDouble"
                marginBottom={1}
                selected={selected === 0}
                selectedColor={colors.primary}
            >
                <Box flexDirection="column" alignSelf="center" marginBottom={1}>
                    <Text bold reverse={csm}>
                        [C]lassic
                    </Text>
                    <Text bold reverse={csm}>
                        {' '}
                        自由创建
                    </Text>
                </Box>
                <Box flexDirection="column" alignSelf="center">
                    <Text reverse={csm}> {PullCount}连抽天赋</Text>
                    <Text reverse={csm}>自由分配属性</Text>
                </Box>
            </Box>
            <Box
                flexDirection="column"
                borderStyle="singleDouble"
                selected={selected === 1}
                selectedColor={colors.primary}
            >
                <Box flexDirection="column" alignSelf="center" marginBottom={1}>
                    <Text bold reverse={!csm}>
                        C[E]lebrity
                    </Text>
                    <Text bold reverse={!csm}>
                        {'  '}
                        职业出身
                    </Text>
                </Box>
                <Box flexDirection="column" alignSelf="center">
                    <Text reverse={!csm}>六种职业起点</Text>
                    <Text reverse={!csm}>带着经验重新开始</Text>
                </Box>
            </Box>
        </Box>
    )
}

export default Mode
