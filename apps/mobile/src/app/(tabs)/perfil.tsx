import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Badge, Button, Card, Header, ProgressBar, Screen } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useProgress } from '../../progression/ProgressProvider';
import { Achievements, PerformanceSummary, LocalProgressNote } from '../../components/LearningRewards';
import { colors, textStyles } from '../../theme';
import { AttemptHistory } from '../../components/AttemptHistory';

export default function ProfileScreen() {
  const auth = useAuth();
  const { summary: progress } = useProgress();
  return (
    <Screen>
      <Header eyebrow="MEU PERFIL" title="Cada conquista é sua" description="Aprender no seu ritmo também é avançar." />
      <Card>
        <View style={styles.avatar}><Icon name="profile" size={56} /></View>
        <Text accessibilityRole="header" style={textStyles.heading}>{auth.state.status === 'ready' ? auth.state.me.profile.display_name : 'Participante'}</Text>
        <Text style={textStyles.detail}>Aprendiz de novos caminhos</Text>
        <Badge label="Atividades de demonstração" icon="profile" />
        <ProgressBar label="Atividades concluídas" {...progress} />
      </Card>
      <PerformanceSummary summary={progress} />
      <Achievements />
      <AttemptHistory />
      <LocalProgressNote />
      <Button label="Sair da minha conta" secondary onPress={() => { void auth.logout(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGreen },
});
