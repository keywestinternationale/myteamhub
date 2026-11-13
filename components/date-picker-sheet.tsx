import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { formatDate } from "@/lib/portal-data";

type DatePickerSheetProps = {
  visible: boolean;
  value: Date;
  title: string;
  minimumDate?: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
};

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

function sameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePickerSheet({
  visible,
  value,
  title,
  minimumDate,
  onClose,
  onSelect,
}: DatePickerSheetProps) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
  const leadingDays = monthStart.getDay();
  const cells = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day) : null;
  });
  const today = new Date();

  const chooseDate = (date: Date) => {
    if (minimumDate && date < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate())) {
      return;
    }
    onSelect(date);
    onClose();
  };

  const switchMonth = (direction: -1 | 1) => {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
              <Text style={styles.selectedDate}>{formatDate(value)}</Text>
            </View>
            <Pressable accessibilityLabel="Close calendar" style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons color="#28506B" name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.monthControl}>
            <Pressable accessibilityLabel="Previous month" style={styles.monthButton} onPress={() => switchMonth(-1)}>
              <MaterialCommunityIcons color="#17456A" name="chevron-left" size={24} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {displayMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <Pressable accessibilityLabel="Next month" style={styles.monthButton} onPress={() => switchMonth(1)}>
              <MaterialCommunityIcons color="#17456A" name="chevron-right" size={24} />
            </Pressable>
          </View>

          <View style={styles.calendar}>
            {weekdays.map((weekday, index) => (
              <Text key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Text>
            ))}
            {cells.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const selected = sameCalendarDay(date, value);
              const disabled = Boolean(minimumDate && date < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()));
              const isToday = sameCalendarDay(date, today);
              return (
                <Pressable
                  key={date.toISOString()}
                  accessibilityLabel={`Select ${formatDate(date)}`}
                  disabled={disabled}
                  onPress={() => chooseDate(date)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    selected && styles.daySelected,
                    isToday && !selected && styles.dayToday,
                    disabled && styles.dayDisabled,
                    pressed && !disabled && styles.dayPressed,
                  ]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.todayButton} onPress={() => chooseDate(today)}>
            <Text style={styles.todayText}>Select today</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(8, 31, 52, 0.56)",
    flex: 1,
    justifyContent: "flex-end",
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#EDF4F8",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  dayCell: {
    alignItems: "center",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    marginVertical: 2,
    width: "14.285%",
  },
  dayDisabled: { opacity: 0.28 },
  dayPressed: { backgroundColor: "#DDEAF2" },
  daySelected: { backgroundColor: "#E64D5C" },
  dayText: { color: "#18384F", fontSize: 14, fontWeight: "700" },
  dayTextDisabled: { color: "#738899" },
  dayTextSelected: { color: "#FFFFFF" },
  dayToday: { borderColor: "#6D9DBA", borderWidth: 1 },
  eyebrow: {
    color: "#7A91A1",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#BED0DC",
    borderRadius: 4,
    height: 4,
    marginBottom: 20,
    width: 38,
  },
  monthButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  monthControl: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  monthTitle: { color: "#173E5B", fontSize: 16, fontWeight: "800" },
  selectedDate: { color: "#123A57", fontSize: 21, fontWeight: "800", marginTop: 4 },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxWidth: 620,
    paddingBottom: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    width: "100%",
  },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  todayButton: {
    alignItems: "center",
    backgroundColor: "#EAF2F7",
    borderRadius: 14,
    marginTop: 18,
    paddingVertical: 13,
  },
  todayText: { color: "#164869", fontSize: 14, fontWeight: "800" },
  weekday: {
    color: "#7890A0",
    fontSize: 11,
    fontWeight: "800",
    paddingBottom: 8,
    textAlign: "center",
    width: "14.285%",
  },
});
