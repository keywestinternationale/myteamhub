import { Image, StyleSheet, Text, View } from "react-native";

type PortalLogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function PortalLogo({ compact = false, inverse = false }: PortalLogoProps) {
  const textColor = inverse ? "#FFFFFF" : "#102A43";
  const mutedColor = inverse ? "rgba(255,255,255,0.72)" : "#60758A";

  return (
    <View style={styles.row}>
      <Image
        accessibilityLabel="Employee Portal mark"
        source={require("../assets/images/icon.png")}
        style={[styles.logo, compact && styles.logoCompact]}
      />
      {!compact && (
        <View>
          <Text style={[styles.title, { color: textColor }]}>Employee Portal</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>OPTIMUM · KEYWEST</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  logo: {
    borderRadius: 13,
    height: 42,
    width: 42,
  },
  logoCompact: {
    borderRadius: 11,
    height: 36,
    width: 36,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
