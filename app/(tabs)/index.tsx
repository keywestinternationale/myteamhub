import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DatePickerSheet } from "@/components/date-picker-sheet";
import { PortalLogo } from "@/components/portal-logo";
import { trpc } from "@/lib/trpc";
import {
  DAILY_SALES_ITEMS,
  EMPLOYEE,
  HOME_MENU,
  initialDailySalesForm,
  initialLeaveForm,
  LOCATIONS,
  PAY_OPTIONS,
  REQUEST_MENU,
  salesTotal,
  type DailySalesForm,
  type LeaveForm,
  type PortalView,
  type SalesItem,
  daysBetween,
  formatDate,
  formatShortDate,
  STORES,
} from "@/lib/portal-data";

type SelectField = "location" | "store" | "pay" | null;
type DateField = "fromDate" | "toDate" | null;
type SubmittedLeave = {
  totalDays: number;
  fromDate: Date;
  toDate: Date;
  reason: string;
};
type SubmittedSales = {
  reportId: string;
  status: "pending" | "processing" | "processed" | "failed";
  duplicate: boolean;
  salesDate: Date;
  itemCount: number;
  totalAmount: number;
};

type DailySalesSubmission = SubmittedSales;

function formatApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const Icon = MaterialCommunityIcons;

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function ScreenHeader({
  onNotifications,
  onProfile,
  showBack,
  onBack,
  title,
}: {
  onNotifications: () => void;
  onProfile: () => void;
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}) {
  return (
    <View style={styles.screenHeader}>
      {showBack ? (
        <View style={styles.headerTitleRow}>
          <Pressable accessibilityLabel="Back to dashboard" hitSlop={10} onPress={onBack} style={styles.headerIconButton}>
            <Icon color="#173E5B" name="arrow-left" size={23} />
          </Pressable>
          <Text style={styles.headerScreenTitle}>{title}</Text>
        </View>
      ) : (
        <PortalLogo compact />
      )}
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="View notifications" onPress={onNotifications} style={styles.headerIconButton}>
          <Icon color="#173E5B" name="bell-outline" size={22} />
          <View style={styles.notificationDot} />
        </Pressable>
        <Pressable accessibilityLabel="Open profile menu" onPress={onProfile} style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>{EMPLOYEE.initials}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BottomNavigation({ active, onChange }: { active: PortalView; onChange: (view: PortalView) => void }) {
  const insets = useSafeAreaInsets();
  const items: { key: PortalView; label: string; icon: keyof typeof Icon.glyphMap }[] = [
    { key: "home", label: "Home", icon: "view-dashboard-outline" },
    { key: "request", label: "New request", icon: "file-document-edit-outline" },
    { key: "menu", label: "Menu", icon: "menu" },
  ];

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {items.map((item) => {
        const selected = active === item.key || (item.key === "request" && active === "dailySales");
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={() => onChange(item.key === "request" ? "dailySales" : item.key)}
            style={({ pressed }) => [styles.navItem, selected && styles.navItemActive, pressed && styles.navItemPressed]}
          >
            <Icon color={selected ? "#E64D5C" : "#7890A0"} name={item.icon} size={23} />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const signIn = () => {
    if (!employeeId.trim() || !password.trim()) {
      setError("Enter your employee ID and password to continue.");
      return;
    }
    setError("");
    onSignIn();
  };

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.loginSafeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.loginTopRail}>
            <PortalLogo />
            <View style={styles.loginPill}>
              <View style={styles.loginPillDot} />
              <Text style={styles.loginPillText}>EMPLOYEE SPACE</Text>
            </View>
          </View>

          <View style={styles.loginHero}>
            <View style={styles.heroMarkWrap}>
              <Icon color="#FFFFFF" name="account-tie-outline" size={37} />
            </View>
            <Text style={styles.loginTitle}>Your workday, simplified.</Text>
            <Text style={styles.loginSubtitle}>
              Sign in to manage requests, stay informed, and keep your work essentials within reach.
            </Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardDescription}>Use your Employee Portal credentials.</Text>

            <View style={styles.formGap}>
              <View>
                <FieldLabel>Employee ID</FieldLabel>
                <View style={styles.inputShell}>
                  <Icon color="#688296" name="badge-account-outline" size={21} />
                  <TextInput
                    accessibilityLabel="Employee ID"
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    onChangeText={(value) => {
                      setEmployeeId(value);
                      setError("");
                    }}
                    placeholder="e.g. 10105"
                    placeholderTextColor="#9AABB7"
                    style={styles.loginInput}
                    value={employeeId}
                  />
                </View>
              </View>
              <View>
                <FieldLabel>Password</FieldLabel>
                <View style={styles.inputShell}>
                  <Icon color="#688296" name="lock-outline" size={21} />
                  <TextInput
                    accessibilityLabel="Password"
                    autoCapitalize="none"
                    onChangeText={(value) => {
                      setPassword(value);
                      setError("");
                    }}
                    onSubmitEditing={signIn}
                    placeholder="Enter your password"
                    placeholderTextColor="#9AABB7"
                    secureTextEntry={!showPassword}
                    style={styles.loginInput}
                    value={password}
                  />
                  <Pressable accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={8} onPress={() => setShowPassword((current) => !current)}>
                    <Icon color="#688296" name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} />
                  </Pressable>
                </View>
              </View>
            </View>

            {error ? (
              <View style={styles.inlineError}>
                <Icon color="#C84452" name="alert-circle-outline" size={17} />
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable accessibilityRole="button" onPress={signIn} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>Sign in securely</Text>
              <Icon color="#FFFFFF" name="arrow-right" size={20} />
            </Pressable>

            <Pressable
              onPress={() => {
                setEmployeeId(EMPLOYEE.employeeId);
                setPassword("employeeportal");
                setError("");
              }}
              style={styles.testAccessButton}
            >
              <Icon color="#23608A" name="flask-outline" size={17} />
              <Text style={styles.testAccessText}>Fill test access</Text>
            </Pressable>
          </View>

          <View style={styles.loginFootnote}>
            <Icon color="#7A91A1" name="shield-check-outline" size={18} />
            <Text style={styles.loginFootnoteText}>Prototype mode · Credentials are not sent to the source portal.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Dashboard({
  onChangeView,
  onNotifications,
  onProfile,
  submittedLeave,
  submittedSales,
}: {
  onChangeView: (view: PortalView) => void;
  onNotifications: () => void;
  onProfile: () => void;
  submittedLeave: SubmittedLeave | null;
  submittedSales: SubmittedSales | null;
}) {
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long" }).format(new Date()),
    [],
  );

  return (
    <View style={styles.fill}>
      <ScreenHeader onNotifications={onNotifications} onProfile={onProfile} />
      <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.dateLine}>{dateLabel.toUpperCase()}</Text>
        <Text style={styles.greeting}>Good day, {EMPLOYEE.firstName}.</Text>
        <Text style={styles.greetingDetail}>Here is your employee portal at a glance.</Text>
        <Text style={styles.employeeIdentityLine}>{EMPLOYEE.fullName} · Employee ID {EMPLOYEE.employeeId}</Text>

        <View style={styles.companyCard}>
          <View style={styles.companyAccent} />
          <View style={styles.companyCardContent}>
            <View style={styles.companyCardTop}>
              <View>
                <Text style={styles.companyEyebrow}>YOUR WORKSPACE</Text>
                <Text style={styles.companyTitle}>{EMPLOYEE.company}</Text>
              </View>
              <View style={styles.companyAvatar}>
                <Text style={styles.companyAvatarText}>{EMPLOYEE.initials}</Text>
              </View>
            </View>
            <View style={styles.employeeIdRow}>
              <Icon color="#A9CBDD" name="account-badge-outline" size={17} />
              <Text style={styles.employeeIdText}>Employee ID · {EMPLOYEE.employeeId}</Text>
            </View>
          </View>
        </View>

        <View style={styles.balanceRow}>
          <View style={styles.balanceCard}>
            <View style={[styles.balanceIcon, { backgroundColor: "#EAF3F8" }]}>
              <Icon color="#20628C" name="calendar-clock-outline" size={20} />
            </View>
            <Text style={styles.balanceValue}>0</Text>
            <Text style={styles.balanceLabel}>Leave credit</Text>
          </View>
          <View style={styles.balanceCard}>
            <View style={[styles.balanceIcon, { backgroundColor: "#FFF0F1" }]}>
              <Icon color="#D94D5B" name="file-clock-outline" size={20} />
            </View>
            <Text style={styles.balanceValue}>{submittedLeave || submittedSales ? "1" : "0"}</Text>
            <Text style={styles.balanceLabel}>Requests pending</Text>
          </View>
        </View>

        <Pressable onPress={() => onChangeView("dailySales")} style={({ pressed }) => [styles.requestBanner, pressed && styles.requestBannerPressed]}>
          <View style={styles.requestBannerIcon}>
            <Icon color="#FFFFFF" name="cash-register" size={24} />
          </View>
          <View style={styles.requestBannerContent}>
            <Text style={styles.requestBannerTitle}>Record today&apos;s sales</Text>
            <Text style={styles.requestBannerCopy}>Add items and save your Daily Sales report.</Text>
          </View>
          <Icon color="#F9CDD2" name="chevron-right" size={24} />
        </Pressable>

        <SectionLabel>Employee tools</SectionLabel>
        <View style={styles.toolsCard}>
          <ToolRow icon="clock-outline" label="Daily Time Record" detail="View attendance" onPress={() => onChangeView("menu")} />
          <View style={styles.hairline} />
          <ToolRow icon="cash-register" label="Daily Sales" detail="Record today&apos;s sales" onPress={() => onChangeView("dailySales")} highlight />
          <View style={styles.hairline} />
          <ToolRow icon="calendar-plus" label="Leave Request" detail="Create a new request" onPress={() => onChangeView("request")} />
        </View>

        <SectionLabel>Latest activity</SectionLabel>
        {submittedSales ? (
          <View style={styles.activityCard}>
            <View style={[styles.activityIcon, { backgroundColor: "#E5F4ED" }]}>
              <Icon color="#23714E" name="check-circle-outline" size={21} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>Daily Sales saved</Text>
              <Text style={styles.activityDetail}>
                {formatShortDate(submittedSales.salesDate)} · {submittedSales.itemCount} item{submittedSales.itemCount === 1 ? "" : "s"} · PHP {submittedSales.totalAmount.toFixed(2)}
              </Text>
            </View>
            <Icon color="#8BA0AE" name="chevron-right" size={22} />
          </View>
        ) : submittedLeave ? (
          <View style={styles.activityCard}>
            <View style={[styles.activityIcon, { backgroundColor: "#E5F4ED" }]}>
              <Icon color="#23714E" name="check-circle-outline" size={21} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>Leave request submitted</Text>
              <Text style={styles.activityDetail}>
                {formatShortDate(submittedLeave.fromDate)} – {formatShortDate(submittedLeave.toDate)} · Pending review
              </Text>
            </View>
            <Icon color="#8BA0AE" name="chevron-right" size={22} />
          </View>
        ) : (
          <View style={styles.emptyActivity}>
            <Icon color="#7B9AAF" name="bullhorn-outline" size={22} />
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>No new announcements</Text>
              <Text style={styles.activityDetail}>Your portal is up to date.</Text>
            </View>
          </View>
        )}

        <View style={styles.prototypeNote}>
          <Icon color="#648195" name="information-outline" size={17} />
          <Text style={styles.prototypeNoteText}>This interactive prototype mirrors the key portal workflow without sending data to the live system.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ToolRow({
  icon,
  label,
  detail,
  onPress,
  highlight = false,
}: {
  icon: keyof typeof Icon.glyphMap;
  label: string;
  detail: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toolRow, pressed && styles.toolRowPressed]}>
      <View style={[styles.toolIcon, highlight && styles.toolIconHighlighted]}>
        <Icon color={highlight ? "#E34B5A" : "#28618A"} name={icon} size={21} />
      </View>
      <View style={styles.toolTextWrap}>
        <Text style={styles.toolLabel}>{label}</Text>
        <Text style={styles.toolDetail}>{detail}</Text>
      </View>
      <Icon color="#91A6B4" name="chevron-right" size={22} />
    </Pressable>
  );
}

function DailySalesScreen({
  sales,
  onSalesChange,
  onChangeView,
  onNotifications,
  onProfile,
  onSubmit,
}: {
  sales: DailySalesForm;
  onSalesChange: (update: Partial<DailySalesForm>) => void;
  onChangeView: (view: PortalView) => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSubmit: (submission: DailySalesSubmission) => void;
}) {
  const [dateVisible, setDateVisible] = useState(false);
  const [activeSelect, setActiveSelect] = useState<"location" | "store" | null>(null);
  const [itemSelectId, setItemSelectId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [idempotencyKey] = useState(() => `daily-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
  const submitDailySales = trpc.dailySales.submit.useMutation();
  const totalAmount = sales.items.length ? salesTotal(sales.items) : Number(sales.totalAmount) || 0;

  const updateItem = (id: string, update: Partial<SalesItem>) => {
    onSalesChange({ items: sales.items.map((item) => (item.id === id ? { ...item, ...update } : item)) });
  };

  const addItem = () => {
    onSalesChange({
      totalAmount: "",
      items: [...sales.items, { id: `${Date.now()}-${sales.items.length}`, item: "", quantity: "1", totalAmount: "" }],
    });
    setFormError("");
  };

  const saveSales = async () => {
    if (!sales.items.length && Number(sales.totalAmount) <= 0) {
      setFormError("Enter the daily total amount or add optional item details.");
      return;
    }
    if (sales.items.some((item) => !item.item || Number(item.quantity) <= 0 || Number(item.totalAmount) <= 0)) {
      setFormError("Choose an item and enter a quantity and total amount for every row.");
      return;
    }
    setFormError("");
    try {
      const result = await submitDailySales.mutateAsync({
        idempotencyKey,
        employeeId: EMPLOYEE.employeeId,
        salesDate: formatApiDate(sales.salesDate),
        location: sales.location,
        store: sales.store,
        totalAmount,
        items: sales.items.map((item) => ({
          item: item.item,
          quantity: Number(item.quantity),
          totalAmount: Number(item.totalAmount),
        })),
      });
      onSubmit({
        reportId: result.reportId,
        status: result.status,
        duplicate: result.duplicate,
        salesDate: sales.salesDate,
        itemCount: sales.items.length,
        totalAmount,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The Daily Sales report could not be saved. Try again.");
    }
  };

  const optionValues = activeSelect === "location" ? LOCATIONS : STORES;
  const optionTitle = activeSelect === "location" ? "Choose location" : "Choose store";
  const selectedItem = sales.items.find((item) => item.id === itemSelectId);

  return (
    <View style={styles.fill}>
      <ScreenHeader
        onBack={() => onChangeView("home")}
        onNotifications={onNotifications}
        onProfile={onProfile}
        showBack
        title="Daily Sales"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.requestScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formIntro}>
            <Text style={styles.formTitle}>Record daily sales</Text>
            <Text style={styles.formSubtitle}>Add the items sold for the selected store and save the report.</Text>
          </View>

          <View style={styles.employeeStrip}>
            <View style={styles.employeeStripAvatar}>
              <Text style={styles.employeeStripAvatarText}>{EMPLOYEE.initials}</Text>
            </View>
            <View>
              <Text style={styles.employeeStripName}>{EMPLOYEE.fullName}</Text>
              <Text style={styles.employeeStripDetail}>{EMPLOYEE.employeeId} · {EMPLOYEE.company}</Text>
            </View>
          </View>

          <SectionLabel>Sales details</SectionLabel>
          <DateFieldButton label="Sales date" value={formatDate(sales.salesDate)} onPress={() => setDateVisible(true)} />
          <SelectFieldButton label="Location" value={sales.location} onPress={() => setActiveSelect("location")} />
          <SelectFieldButton label="Store" value={sales.store} onPress={() => setActiveSelect("store")} compact />

          <View style={styles.quickTotalCard}>
            <View style={styles.quickTotalCopy}>
              <Text style={styles.quickTotalTitle}>Daily total amount</Text>
              <Text style={styles.quickTotalSubtitle}>Item details are optional.</Text>
            </View>
            <View style={styles.quickTotalInputShell}>
              <Text style={styles.currencyPrefix}>PHP</Text>
              <TextInput
                accessibilityLabel="Daily total amount"
                editable={!sales.items.length}
                keyboardType="decimal-pad"
                onChangeText={(totalAmount) => onSalesChange({ totalAmount: totalAmount.replace(/[^0-9.]/g, "") })}
                placeholder="0.00"
                placeholderTextColor="#9AABB7"
                style={styles.quickTotalInput}
                value={sales.items.length ? totalAmount.toFixed(2) : sales.totalAmount}
              />
            </View>
          </View>

          <View style={styles.itemsHeader}>
            <SectionLabel>Optional item details</SectionLabel>
            <Text style={styles.itemCount}>{sales.items.length} item{sales.items.length === 1 ? "" : "s"}</Text>
          </View>
          {sales.items.map((item, index) => (
            <View key={item.id} style={styles.salesItemCard}>
              <View style={styles.salesItemTopline}>
                <Text style={styles.salesItemNumber}>ITEM {index + 1}</Text>
                <Pressable accessibilityLabel={`Remove item ${index + 1}`} hitSlop={8} onPress={() => onSalesChange({ items: sales.items.filter((candidate) => candidate.id !== item.id) })}>
                  <Icon color="#C45862" name="trash-can-outline" size={19} />
                </Pressable>
              </View>
              <Pressable onPress={() => setItemSelectId(item.id)} style={({ pressed }) => [styles.salesItemSelector, pressed && styles.fieldPressed]}>
                <Text numberOfLines={2} style={[styles.salesItemSelectorText, !item.item && styles.salesItemPlaceholder]}>{item.item || "Select item..."}</Text>
                <Icon color="#54788E" name="chevron-down" size={20} />
              </Pressable>
              <View style={styles.salesNumbersRow}>
                <View style={styles.salesNumberField}>
                  <FieldLabel>Quantity</FieldLabel>
                  <TextInput
                    accessibilityLabel={`Quantity for item ${index + 1}`}
                    keyboardType="number-pad"
                    onChangeText={(quantity) => updateItem(item.id, { quantity: quantity.replace(/[^0-9]/g, "") })}
                    placeholder="0"
                    placeholderTextColor="#9AABB7"
                    style={styles.salesNumberInput}
                    value={item.quantity}
                  />
                </View>
                <View style={styles.salesNumberField}>
                  <FieldLabel>Total amount</FieldLabel>
                  <View style={styles.amountInputShell}>
                    <Text style={styles.currencyPrefix}>PHP</Text>
                    <TextInput
                      accessibilityLabel={`Total amount for item ${index + 1}`}
                      keyboardType="decimal-pad"
                      onChangeText={(total) => updateItem(item.id, { totalAmount: total.replace(/[^0-9.]/g, "") })}
                      placeholder="0.00"
                      placeholderTextColor="#9AABB7"
                      style={styles.amountInput}
                      value={item.totalAmount}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}

          <Pressable onPress={addItem} style={({ pressed }) => [styles.addItemButton, pressed && styles.addItemButtonPressed]}>
            <Icon color="#23658A" name="plus-circle-outline" size={21} />
            <Text style={styles.addItemText}>Add item</Text>
          </Pressable>

          <View style={styles.salesTotalPanel}>
            <View>
              <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
              <Text style={styles.salesTotalValue}>PHP {totalAmount.toFixed(2)}</Text>
            </View>
            <Icon color="#57819A" name="cash-multiple" size={25} />
          </View>

          {formError ? (
            <View style={styles.inlineError}>
              <Icon color="#C84452" name="alert-circle-outline" size={17} />
              <Text style={styles.inlineErrorText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.formTip}>
            <Icon color="#387293" name="information-outline" size={20} />
            <Text style={styles.formTipText}>You can save with the daily total only. Add item rows when you need a detailed breakdown.</Text>
          </View>

          <View style={styles.formButtons}>
            <Pressable
              onPress={() => {
                onSalesChange(initialDailySalesForm());
                onChangeView("home");
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable disabled={submitDailySales.isPending} onPress={saveSales} style={({ pressed }) => [styles.submitButton, pressed && styles.primaryButtonPressed, submitDailySales.isPending && styles.submitButtonDisabled]}>
              <Text style={styles.submitButtonText}>{submitDailySales.isPending ? "Saving..." : "Save Daily Sales"}</Text>
              <Icon color="#FFFFFF" name="content-save-outline" size={19} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerSheet
        key={`sales-calendar-${sales.salesDate.toDateString()}`}
        onClose={() => setDateVisible(false)}
        onSelect={(date) => {
          onSalesChange({ salesDate: date });
          setDateVisible(false);
        }}
        title="Select sales date"
        value={sales.salesDate}
        visible={dateVisible}
      />
      <OptionSheet
        onClose={() => setActiveSelect(null)}
        onSelect={(value) => {
          if (activeSelect) onSalesChange({ [activeSelect]: value });
          setActiveSelect(null);
        }}
        options={optionValues}
        selected={activeSelect ? sales[activeSelect] : ""}
        title={optionTitle}
        visible={activeSelect !== null}
      />
      <OptionSheet
        onClose={() => setItemSelectId(null)}
        onSelect={(value) => {
          if (selectedItem) updateItem(selectedItem.id, { item: value });
          setItemSelectId(null);
        }}
        options={DAILY_SALES_ITEMS}
        selected={selectedItem?.item ?? ""}
        title="Choose item"
        visible={itemSelectId !== null}
      />
    </View>
  );
}

function LeaveRequestScreen({
  leave,
  onLeaveChange,
  onChangeView,
  onNotifications,
  onProfile,
  onSubmit,
}: {
  leave: LeaveForm;
  onLeaveChange: (update: Partial<LeaveForm>) => void;
  onChangeView: (view: PortalView) => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSubmit: () => boolean;
}) {
  const [activeDate, setActiveDate] = useState<DateField>(null);
  const [activeSelect, setActiveSelect] = useState<SelectField>(null);
  const [reasonError, setReasonError] = useState(false);
  const totalDays = daysBetween(leave.fromDate, leave.toDate);

  const selectDate = (date: Date) => {
    if (activeDate === "fromDate") {
      const keepToDate = date > leave.toDate ? date : leave.toDate;
      onLeaveChange({ fromDate: date, toDate: keepToDate });
    }
    if (activeDate === "toDate") {
      onLeaveChange({ toDate: date });
    }
  };

  const saveRequest = () => {
    if (!leave.reason.trim()) {
      setReasonError(true);
      return;
    }
    if (onSubmit()) {
      setReasonError(false);
    }
  };

  const selectionOptions = activeSelect === "location" ? LOCATIONS : activeSelect === "store" ? STORES : PAY_OPTIONS;
  const selectionTitle = activeSelect === "location" ? "Choose location" : activeSelect === "store" ? "Choose store" : "Choose pay type";

  return (
    <View style={styles.fill}>
      <ScreenHeader
        onBack={() => onChangeView("home")}
        onNotifications={onNotifications}
        onProfile={onProfile}
        showBack
        title="Leave Request"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.requestScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formIntro}>
            <Text style={styles.formTitle}>Request time away</Text>
            <Text style={styles.formSubtitle}>Complete the details below. Your request will be sent for review.</Text>
          </View>

          <View style={styles.employeeStrip}>
            <View style={styles.employeeStripAvatar}>
              <Text style={styles.employeeStripAvatarText}>{EMPLOYEE.initials}</Text>
            </View>
            <View>
              <Text style={styles.employeeStripName}>{EMPLOYEE.fullName}</Text>
              <Text style={styles.employeeStripDetail}>{EMPLOYEE.employeeId} · {EMPLOYEE.company}</Text>
            </View>
          </View>

          <SectionLabel>Request dates</SectionLabel>
          <View style={styles.dateRow}>
            <DateFieldButton label="From date" value={formatDate(leave.fromDate)} onPress={() => setActiveDate("fromDate")} />
            <DateFieldButton label="To date" value={formatDate(leave.toDate)} onPress={() => setActiveDate("toDate")} />
          </View>
          <View style={styles.totalPanel}>
            <View>
              <Text style={styles.totalLabel}>TOTAL DAYS</Text>
              <Text style={styles.totalValue}>{totalDays} {totalDays === 1 ? "day" : "days"}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View>
              <Text style={styles.totalLabel}>LEAVE CREDIT</Text>
              <Text style={styles.totalValue}>0 day</Text>
            </View>
            <View style={styles.totalInfo}>
              <Icon color="#57819A" name="information-outline" size={18} />
            </View>
          </View>

          <SectionLabel>Work details</SectionLabel>
          <SelectFieldButton label="Location" value={leave.location} onPress={() => setActiveSelect("location")} />
          <SelectFieldButton label="Store" value={leave.store} onPress={() => setActiveSelect("store")} compact />
          <SelectFieldButton label="Pay" value={leave.pay} onPress={() => setActiveSelect("pay")} />

          <SectionLabel>Reason</SectionLabel>
          <View style={[styles.reasonBox, reasonError && styles.reasonBoxError]}>
            <TextInput
              accessibilityLabel="Reason for leave"
              maxLength={240}
              multiline
              onChangeText={(reason) => {
                onLeaveChange({ reason });
                if (reason.trim()) setReasonError(false);
              }}
              placeholder="Briefly tell us why you need leave..."
              placeholderTextColor="#9AABB7"
              style={styles.reasonInput}
              textAlignVertical="top"
              value={leave.reason}
            />
            <Text style={styles.reasonCount}>{leave.reason.length}/240</Text>
          </View>
          {reasonError ? <Text style={styles.fieldError}>Please provide a reason for this leave request.</Text> : null}

          <View style={styles.formTip}>
            <Icon color="#387293" name="shield-check-outline" size={20} />
            <Text style={styles.formTipText}>Review your dates and work details before submitting. You can edit them until your request is reviewed.</Text>
          </View>

          <View style={styles.formButtons}>
            <Pressable
              onPress={() => {
                onLeaveChange(initialLeaveForm());
                onChangeView("home");
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveRequest} style={({ pressed }) => [styles.submitButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.submitButtonText}>Save &amp; submit</Text>
              <Icon color="#FFFFFF" name="send-outline" size={19} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerSheet
        key={`calendar-${activeDate ?? "closed"}-${(activeDate === "fromDate" ? leave.fromDate : leave.toDate).toDateString()}`}
        minimumDate={activeDate === "toDate" ? leave.fromDate : undefined}
        onClose={() => setActiveDate(null)}
        onSelect={selectDate}
        title={activeDate === "fromDate" ? "Select from date" : "Select to date"}
        value={activeDate === "fromDate" ? leave.fromDate : leave.toDate}
        visible={activeDate !== null}
      />
      <OptionSheet
        onClose={() => setActiveSelect(null)}
        onSelect={(value) => {
          if (activeSelect) onLeaveChange({ [activeSelect]: value });
          setActiveSelect(null);
        }}
        options={selectionOptions}
        selected={activeSelect ? leave[activeSelect] : ""}
        title={selectionTitle}
        visible={activeSelect !== null}
      />
    </View>
  );
}

function DateFieldButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dateField, pressed && styles.fieldPressed]}>
      <Text style={styles.dateFieldLabel}>{label.toUpperCase()}</Text>
      <View style={styles.dateValueRow}>
        <Icon color="#21648D" name="calendar-blank-outline" size={18} />
        <Text style={styles.dateFieldValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

function SelectFieldButton({
  label,
  value,
  onPress,
  compact = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <View style={styles.selectGroup}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.selectField, compact && styles.selectFieldCompact, pressed && styles.fieldPressed]}>
        <Text numberOfLines={compact ? 2 : 1} style={styles.selectFieldValue}>{value}</Text>
        <Icon color="#54788E" name="chevron-down" size={21} />
      </Pressable>
    </View>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.optionSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.optionSheetHeader}>
            <Text style={styles.optionSheetTitle}>{title}</Text>
            <Pressable accessibilityLabel="Close options" onPress={onClose} style={styles.closeCircle}>
              <Icon color="#28506B" name="close" size={21} />
            </Pressable>
          </View>
          {options.map((option) => {
            const isSelected = option === selected;
            return (
              <Pressable key={option} onPress={() => onSelect(option)} style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                {isSelected ? <Icon color="#E64D5C" name="check-circle" size={21} /> : <View style={styles.optionEmpty} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuScreen({
  onChangeView,
  onNotifications,
  onProfile,
  onSignOut,
}: {
  onChangeView: (view: PortalView) => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.fill}>
      <ScreenHeader onNotifications={onNotifications} onProfile={onProfile} />
      <ScrollView contentContainerStyle={styles.menuScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.menuTitle}>Menu</Text>
        <Text style={styles.menuSubtitle}>Browse your employee portal tools.</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{EMPLOYEE.initials}</Text></View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{EMPLOYEE.fullName}</Text>
            <Text style={styles.profileDetail}>{EMPLOYEE.employeeId} · {EMPLOYEE.company}</Text>
          </View>
          <Icon color="#9CB1BE" name="chevron-right" size={22} />
        </View>

        <SectionLabel>Work tools</SectionLabel>
        <View style={styles.menuCard}>
          <MenuRow icon="clock-outline" label="DTR" onPress={() => onChangeView("home")} />
          <View style={styles.hairline} />
          <MenuRow icon="cash-register" label="Daily Sales" onPress={() => onChangeView("dailySales")} featured />
          <View style={styles.hairline} />
          <MenuRow icon="file-document-edit-outline" label="Leave Request" onPress={() => onChangeView("request")} muted />
          <View style={styles.hairline} />
          {REQUEST_MENU.filter((item) => item !== "Leave" && item !== "Daily Sales").slice(0, 3).map((item) => (
            <MenuRow key={item} icon="file-outline" label={item} onPress={() => onChangeView("home")} muted />
          ))}
        </View>

        <SectionLabel>Company</SectionLabel>
        <View style={styles.menuCard}>
          {HOME_MENU.map((item, index) => (
            <View key={item}>
              {index > 0 ? <View style={styles.hairline} /> : null}
              <MenuRow icon={item === "Announcements" ? "bullhorn-outline" : "office-building-outline"} label={item} onPress={() => onChangeView("home")} muted />
            </View>
          ))}
        </View>

        <SectionLabel>Review & reports</SectionLabel>
        <View style={styles.menuCard}>
          <MenuRow icon="clipboard-check-outline" label="Validation" onPress={() => onChangeView("home")} muted />
          <View style={styles.hairline} />
          <MenuRow icon="chart-box-outline" label="Reports" onPress={() => onChangeView("home")} muted />
        </View>

        <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
          <Icon color="#BD4452" name="logout" size={20} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  featured = false,
  muted = false,
}: {
  icon: keyof typeof Icon.glyphMap;
  label: string;
  onPress: () => void;
  featured?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.toolRowPressed]}>
      <View style={[styles.menuIcon, featured && styles.menuIconFeatured]}>
        <Icon color={featured ? "#E64D5C" : "#377193"} name={icon} size={20} />
      </View>
      <Text style={[styles.menuRowText, muted && styles.menuRowTextMuted]}>{label}</Text>
      {featured ? <Text style={styles.newTag}>START</Text> : null}
      <Icon color="#9CB0BC" name="chevron-right" size={21} />
    </Pressable>
  );
}

function NotificationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.centerBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.notificationModal}>
          <View style={styles.notificationIconLarge}><Icon color="#246488" name="bell-outline" size={29} /></View>
          <Text style={styles.notificationTitle}>You are all caught up</Text>
          <Text style={styles.notificationCopy}>There are no new portal notifications for this prototype account.</Text>
          <Pressable onPress={onClose} style={styles.modalPrimaryButton}><Text style={styles.modalPrimaryText}>Done</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ConfirmationModal({
  visible,
  submitted,
  submittedSales,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  submitted?: SubmittedLeave | null;
  submittedSales?: SubmittedSales | null;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const success = Boolean(submitted || submittedSales);
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.centerBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.confirmModal}>
          <View style={[styles.confirmIcon, success ? styles.confirmSuccessIcon : styles.confirmSignOutIcon]}>
            <Icon color={success ? "#24734D" : "#C04553"} name={success ? "check-circle-outline" : "logout"} size={31} />
          </View>
          <Text style={styles.confirmTitle}>{submittedSales ? "Daily Sales saved" : success ? "Request submitted" : "Sign out of Employee Portal?"}</Text>
          <Text style={styles.confirmCopy}>
            {submittedSales
              ? `Your Daily Sales report for ${formatShortDate(submittedSales.salesDate)} with ${submittedSales.itemCount} item${submittedSales.itemCount === 1 ? "" : "s"} totaling PHP ${submittedSales.totalAmount.toFixed(2)} is saved in the integration inbox and pending portal processing.`
              : success && submitted
              ? `Your ${submitted.totalDays}-day leave request for ${formatShortDate(submitted.fromDate)} to ${formatShortDate(submitted.toDate)} has been sent for review.`
              : "You can sign in again at any time using your Employee Portal credentials."}
          </Text>
          {success ? (
            <Pressable onPress={onClose} style={styles.modalPrimaryButton}><Text style={styles.modalPrimaryText}>Back to dashboard</Text></Pressable>
          ) : (
            <View style={styles.confirmActions}>
              <Pressable onPress={onClose} style={styles.modalSecondaryButton}><Text style={styles.modalSecondaryText}>Stay signed in</Text></Pressable>
              <Pressable onPress={onConfirm} style={styles.modalDangerButton}><Text style={styles.modalDangerText}>Sign out</Text></Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function EmployeePortalScreen() {
  const [signedIn, setSignedIn] = useState(false);
  const [view, setView] = useState<PortalView>("home");
  const [leave, setLeave] = useState<LeaveForm>(initialLeaveForm());
  const [sales, setSales] = useState<DailySalesForm>(initialDailySalesForm());
  const [submittedLeave, setSubmittedLeave] = useState<SubmittedLeave | null>(null);
  const [submittedSales, setSubmittedSales] = useState<SubmittedSales | null>(null);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState<"leave" | "sales" | false>(false);
  const [signOutVisible, setSignOutVisible] = useState(false);

  const updateLeave = (update: Partial<LeaveForm>) => setLeave((current) => ({ ...current, ...update }));

  const submitLeave = () => {
    const request = {
      totalDays: daysBetween(leave.fromDate, leave.toDate),
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      reason: leave.reason,
    };
    setSubmittedLeave(request);
    setSuccessVisible("leave");
    return true;
  };

  const updateSales = (update: Partial<DailySalesForm>) => setSales((current) => ({ ...current, ...update }));

  const submitSales = (submission: DailySalesSubmission) => {
    setSubmittedSales(submission);
    setSuccessVisible("sales");
  };

  const signOut = () => {
    setSignOutVisible(false);
    setSuccessVisible(false);
    setNotificationsVisible(false);
    setView("home");
    setLeave(initialLeaveForm());
    setSales(initialDailySalesForm());
    setSignedIn(false);
  };

  if (!signedIn) {
    return <SignInScreen onSignIn={() => setSignedIn(true)} />;
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.appSafeArea}>
      <StatusBar style="dark" />
      <View style={styles.appContent}>
        {view === "home" ? <Dashboard onChangeView={setView} onNotifications={() => setNotificationsVisible(true)} onProfile={() => setView("menu")} submittedLeave={submittedLeave} submittedSales={submittedSales} /> : null}
        {view === "dailySales" ? <DailySalesScreen onChangeView={setView} onNotifications={() => setNotificationsVisible(true)} onProfile={() => setView("menu")} onSalesChange={updateSales} onSubmit={submitSales} sales={sales} /> : null}
        {view === "request" ? <LeaveRequestScreen leave={leave} onChangeView={setView} onLeaveChange={updateLeave} onNotifications={() => setNotificationsVisible(true)} onProfile={() => setView("menu")} onSubmit={submitLeave} /> : null}
        {view === "menu" ? <MenuScreen onChangeView={setView} onNotifications={() => setNotificationsVisible(true)} onProfile={() => setView("menu")} onSignOut={() => setSignOutVisible(true)} /> : null}
      </View>
      <BottomNavigation active={view} onChange={setView} />
      <NotificationSheet onClose={() => setNotificationsVisible(false)} visible={notificationsVisible} />
      <ConfirmationModal
        onClose={() => {
          setSuccessVisible(false);
          setView("home");
          setLeave(initialLeaveForm());
          setSales(initialDailySalesForm());
        }}
        submitted={successVisible === "leave" ? submittedLeave : null}
        submittedSales={successVisible === "sales" ? submittedSales : null}
        visible={Boolean(successVisible)}
      />
      <ConfirmationModal
        onClose={() => setSignOutVisible(false)}
        onConfirm={signOut}
        visible={signOutVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activityCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DFEAF0", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 },
  activityCopy: { flex: 1 },
  activityDetail: { color: "#6F8797", fontSize: 12, lineHeight: 17, marginTop: 3 },
  activityIcon: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  activityTitle: { color: "#1A405A", fontSize: 14, fontWeight: "800" },
  appContent: { flex: 1, maxWidth: 700, width: "100%" },
  appSafeArea: { alignItems: "center", backgroundColor: "#F4F7F9", flex: 1 },
  avatarSmall: { alignItems: "center", backgroundColor: "#E6F0F5", borderColor: "#CADDE8", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", width: 32 },
  avatarSmallText: { color: "#1D587E", fontSize: 10, fontWeight: "900" },
  balanceCard: { backgroundColor: "#FFFFFF", borderColor: "#DFEAF0", borderRadius: 18, borderWidth: 1, flex: 1, padding: 15 },
  balanceIcon: { alignItems: "center", borderRadius: 11, height: 38, justifyContent: "center", marginBottom: 12, width: 38 },
  balanceLabel: { color: "#708797", fontSize: 12, fontWeight: "600", marginTop: 2 },
  balanceRow: { flexDirection: "row", gap: 11, marginTop: 12 },
  balanceValue: { color: "#163C57", fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  bottomNav: { backgroundColor: "#FFFFFF", borderTopColor: "#D9E5EB", borderTopWidth: 1, flexDirection: "row", maxWidth: 700, paddingHorizontal: 18, paddingTop: 10, width: "100%" },
  cardDescription: { color: "#6C8494", fontSize: 14, lineHeight: 20, marginTop: 4 },
  cardTitle: { color: "#133C59", fontSize: 23, fontWeight: "900", letterSpacing: -0.6 },
  centerBackdrop: { alignItems: "center", backgroundColor: "rgba(10, 35, 53, 0.58)", flex: 1, justifyContent: "center", padding: 24 },
  closeCircle: { alignItems: "center", backgroundColor: "#EEF4F7", borderRadius: 17, height: 34, justifyContent: "center", width: 34 },
  companyAccent: { backgroundColor: "#E95160", bottom: 0, position: "absolute", right: 0, top: 0, width: 7 },
  companyAvatar: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)", borderRadius: 22, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  companyAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  companyCard: { backgroundColor: "#154C70", borderRadius: 22, marginTop: 21, overflow: "hidden" },
  companyCardContent: { padding: 19 },
  companyCardTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  companyEyebrow: { color: "#A8C9DC", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  companyTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", letterSpacing: -0.3, marginTop: 4 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 23 },
  confirmCopy: { color: "#688091", fontSize: 14, lineHeight: 21, textAlign: "center" },
  confirmIcon: { alignItems: "center", borderRadius: 25, height: 50, justifyContent: "center", marginBottom: 15, width: 50 },
  confirmModal: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 25, maxWidth: 410, padding: 25, width: "100%" },
  confirmSignOutIcon: { backgroundColor: "#FDECEF" },
  confirmSuccessIcon: { backgroundColor: "#E8F6EE" },
  confirmTitle: { color: "#163E5A", fontSize: 21, fontWeight: "900", letterSpacing: -0.4, marginBottom: 8, textAlign: "center" },
  dateField: { backgroundColor: "#FFFFFF", borderColor: "#DCE8EF", borderRadius: 15, borderWidth: 1, flex: 1, padding: 14 },
  dateFieldLabel: { color: "#7991A1", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  dateFieldValue: { color: "#1D4965", flex: 1, fontSize: 13, fontWeight: "800" },
  dateRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  dateValueRow: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 8 },
  dateLine: { color: "#768F9F", fontSize: 10, fontWeight: "900", letterSpacing: 1.05 },
  employeeIdRow: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 15 },
  employeeIdText: { color: "#D2E6F1", fontSize: 12, fontWeight: "700" },
  employeeIdentityLine: { color: "#78909F", fontSize: 11, fontWeight: "700", marginTop: 8 },
  employeeStrip: { alignItems: "center", backgroundColor: "#EBF4F8", borderRadius: 16, flexDirection: "row", gap: 11, marginTop: 17, padding: 13 },
  employeeStripAvatar: { alignItems: "center", backgroundColor: "#D1E5EF", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  employeeStripAvatarText: { color: "#235E83", fontSize: 11, fontWeight: "900" },
  employeeStripDetail: { color: "#718999", fontSize: 11, fontWeight: "600", marginTop: 2 },
  employeeStripName: { color: "#244A63", fontSize: 13, fontWeight: "800" },
  emptyActivity: { alignItems: "center", backgroundColor: "#F0F7FA", borderColor: "#DDEAF0", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, flexDirection: "row", gap: 12, padding: 15 },
  fieldError: { color: "#C84452", fontSize: 12, fontWeight: "700", marginTop: 7 },
  fieldLabel: { color: "#547082", fontSize: 12, fontWeight: "800", marginBottom: 7 },
  fieldPressed: { backgroundColor: "#F5FAFC", borderColor: "#77A4BD" },
  fill: { flex: 1 },
  formButtons: { flexDirection: "row", gap: 11, marginBottom: 28, marginTop: 21 },
  formGap: { gap: 17, marginTop: 23 },
  formIntro: { marginTop: 4 },
  formSubtitle: { color: "#6C8494", fontSize: 14, lineHeight: 20, marginTop: 5 },
  formTip: { alignItems: "flex-start", backgroundColor: "#EAF4F8", borderRadius: 14, flexDirection: "row", gap: 9, marginTop: 18, padding: 13 },
  formTipText: { color: "#477089", flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  formTitle: { color: "#143E5B", fontSize: 25, fontWeight: "900", letterSpacing: -0.7 },
  greeting: { color: "#143E5B", fontSize: 27, fontWeight: "900", letterSpacing: -0.8, marginTop: 7 },
  greetingDetail: { color: "#698293", fontSize: 14, marginTop: 4 },
  hairline: { backgroundColor: "#E3EDF2", height: 1, marginLeft: 65 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 9 },
  headerIconButton: { alignItems: "center", height: 36, justifyContent: "center", position: "relative", width: 36 },
  headerScreenTitle: { color: "#173E5B", fontSize: 17, fontWeight: "900" },
  headerTitleRow: { alignItems: "center", flexDirection: "row", gap: 4 },
  heroMarkWrap: { alignItems: "center", backgroundColor: "#E64D5C", borderRadius: 23, height: 46, justifyContent: "center", width: 46 },
  inlineError: { alignItems: "center", backgroundColor: "#FFF0F1", borderRadius: 11, flexDirection: "row", gap: 7, marginTop: 15, padding: 11 },
  inlineErrorText: { color: "#B43D4A", flex: 1, fontSize: 12, fontWeight: "700" },
  itemsHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  itemCount: { color: "#7891A1", fontSize: 11, fontWeight: "800", marginTop: 24 },
  inputShell: { alignItems: "center", backgroundColor: "#F8FBFC", borderColor: "#D8E5EB", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 13 },
  loginCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE9EF", borderRadius: 24, borderWidth: 1, marginTop: 29, padding: 21, shadowColor: "#31556B", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20 },
  loginFootnote: { alignItems: "flex-start", flexDirection: "row", gap: 8, marginHorizontal: 11, marginTop: 20 },
  loginFootnoteText: { color: "#748C9C", flex: 1, fontSize: 12, lineHeight: 18 },
  loginHero: { marginTop: 58 },
  loginInput: { color: "#173E5B", flex: 1, fontSize: 15, fontWeight: "600", height: 51 },
  loginPill: { alignItems: "center", backgroundColor: "#E7F2F7", borderRadius: 20, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  loginPillDot: { backgroundColor: "#E64D5C", borderRadius: 4, height: 7, width: 7 },
  loginPillText: { color: "#37708F", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  loginSafeArea: { backgroundColor: "#F4F7F9", flex: 1 },
  loginScroll: { flexGrow: 1, marginHorizontal: "auto", maxWidth: 560, paddingBottom: 30, paddingHorizontal: 22, width: "100%" },
  loginSubtitle: { color: "#668092", fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 360 },
  loginTitle: { color: "#133D5B", fontSize: 33, fontWeight: "900", letterSpacing: -1.1, lineHeight: 38, marginTop: 17, maxWidth: 350 },
  loginTopRail: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  menuCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE9EF", borderRadius: 18, borderWidth: 1, marginTop: 8, overflow: "hidden" },
  menuIcon: { alignItems: "center", backgroundColor: "#ECF5F9", borderRadius: 11, height: 38, justifyContent: "center", width: 38 },
  menuIconFeatured: { backgroundColor: "#FFF0F1" },
  menuRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 63, paddingHorizontal: 14 },
  menuRowText: { color: "#1C435E", flex: 1, fontSize: 14, fontWeight: "800" },
  menuRowTextMuted: { fontWeight: "700" },
  menuScroll: { marginHorizontal: "auto", maxWidth: 650, paddingBottom: 27, paddingHorizontal: 18, width: "100%" },
  menuSubtitle: { color: "#6C8494", fontSize: 14, marginTop: 4 },
  menuTitle: { color: "#143E5B", fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginTop: 12 },
  modalBackdrop: { backgroundColor: "rgba(8, 31, 52, 0.54)", flex: 1, justifyContent: "flex-end" },
  modalDangerButton: { alignItems: "center", backgroundColor: "#E64D5C", borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 47, paddingHorizontal: 13 },
  modalDangerText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  modalPrimaryButton: { alignItems: "center", backgroundColor: "#194F71", borderRadius: 14, justifyContent: "center", marginTop: 23, minHeight: 49, paddingHorizontal: 20, width: "100%" },
  modalPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  modalSecondaryButton: { alignItems: "center", backgroundColor: "#EDF4F7", borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 47, paddingHorizontal: 13 },
  modalSecondaryText: { color: "#31576D", fontSize: 13, fontWeight: "900" },
  navItem: { alignItems: "center", borderRadius: 13, flex: 1, gap: 3, justifyContent: "center", minHeight: 48 },
  navItemActive: { backgroundColor: "#FFF1F2" },
  navItemPressed: { opacity: 0.76 },
  navLabel: { color: "#7890A0", fontSize: 10, fontWeight: "800" },
  navLabelActive: { color: "#D64252" },
  newTag: { color: "#D74757", fontSize: 9, fontWeight: "900", letterSpacing: 0.7, marginRight: 2 },
  notificationDot: { backgroundColor: "#E64D5C", borderColor: "#FFFFFF", borderRadius: 5, borderWidth: 1.5, height: 9, position: "absolute", right: 6, top: 5, width: 9 },
  notificationCopy: { color: "#6B8292", fontSize: 14, lineHeight: 21, textAlign: "center" },
  notificationIconLarge: { alignItems: "center", backgroundColor: "#EAF4F8", borderRadius: 26, height: 52, justifyContent: "center", marginBottom: 14, width: 52 },
  notificationModal: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 25, maxWidth: 390, padding: 25, width: "100%" },
  notificationTitle: { color: "#163E5A", fontSize: 21, fontWeight: "900", marginBottom: 8 },
  optionEmpty: { height: 21, width: 21 },
  optionRow: { alignItems: "center", borderBottomColor: "#E5EDF2", borderBottomWidth: 1, flexDirection: "row", gap: 13, minHeight: 58, paddingVertical: 9 },
  optionRowPressed: { backgroundColor: "#F2F8FA" },
  optionSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxWidth: 620, paddingBottom: 26, paddingHorizontal: 22, paddingTop: 12, width: "100%" },
  optionSheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 9 },
  optionSheetTitle: { color: "#173E5B", fontSize: 19, fontWeight: "900" },
  optionText: { color: "#294B61", flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  optionTextSelected: { color: "#D74757", fontWeight: "900" },
  pageScroll: { marginHorizontal: "auto", maxWidth: 650, paddingBottom: 28, paddingHorizontal: 18, paddingTop: 11, width: "100%" },
  primaryButton: { alignItems: "center", backgroundColor: "#174F72", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 20, minHeight: 53, paddingHorizontal: 18 },
  primaryButtonPressed: { backgroundColor: "#123C59", transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  profileAvatar: { alignItems: "center", backgroundColor: "#1D5B80", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  profileAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  profileCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE9EF", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 21, padding: 14 },
  profileDetail: { color: "#708898", fontSize: 11, fontWeight: "600", marginTop: 3 },
  profileInfo: { flex: 1 },
  profileName: { color: "#1B435F", fontSize: 14, fontWeight: "900" },
  prototypeNote: { alignItems: "flex-start", flexDirection: "row", gap: 7, marginBottom: 4, marginTop: 20, paddingHorizontal: 2 },
  prototypeNoteText: { color: "#79909F", flex: 1, fontSize: 11, lineHeight: 16 },
  reasonBox: { backgroundColor: "#FFFFFF", borderColor: "#DCE8EF", borderRadius: 15, borderWidth: 1, minHeight: 126, padding: 12 },
  reasonBoxError: { borderColor: "#DF5260", borderWidth: 1.5 },
  reasonCount: { alignSelf: "flex-end", color: "#91A3AF", fontSize: 10, fontWeight: "700" },
  reasonInput: { color: "#254B63", flex: 1, fontSize: 14, lineHeight: 20, minHeight: 80, padding: 0 },
  salesItemCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE8EF", borderRadius: 17, borderWidth: 1, marginTop: 8, padding: 13 },
  salesItemNumber: { color: "#7A93A2", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  salesItemPlaceholder: { color: "#9AABB7", fontWeight: "600" },
  salesItemSelector: { alignItems: "center", borderColor: "#DCE8EF", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 10, minHeight: 49, paddingHorizontal: 12 },
  salesItemSelectorText: { color: "#294D64", flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  salesItemTopline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  salesNumbersRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  salesNumberField: { flex: 1 },
  salesNumberInput: { backgroundColor: "#F8FBFC", borderColor: "#DCE8EF", borderRadius: 12, borderWidth: 1, color: "#284C64", fontSize: 14, fontWeight: "800", height: 47, paddingHorizontal: 12 },
  amountInputShell: { alignItems: "center", backgroundColor: "#F8FBFC", borderColor: "#DCE8EF", borderRadius: 12, borderWidth: 1, flexDirection: "row", height: 47, paddingHorizontal: 10 },
  amountInput: { color: "#284C64", flex: 1, fontSize: 14, fontWeight: "800", paddingHorizontal: 6 },
  currencyPrefix: { color: "#7891A1", fontSize: 10, fontWeight: "900" },
  addItemButton: { alignItems: "center", borderColor: "#A8C6D7", borderRadius: 14, borderStyle: "dashed", borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 11, minHeight: 48 },
  addItemButtonPressed: { backgroundColor: "#EAF4F8" },
  addItemText: { color: "#23658A", fontSize: 13, fontWeight: "900" },
  salesTotalPanel: { alignItems: "center", backgroundColor: "#EBF4F8", borderRadius: 16, flexDirection: "row", justifyContent: "space-between", marginTop: 15, padding: 15 },
  salesTotalValue: { color: "#173F5B", fontSize: 20, fontWeight: "900", marginTop: 4 },
  quickTotalCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE8EF", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", marginTop: 17, padding: 14 },
  quickTotalCopy: { flex: 1 },
  quickTotalTitle: { color: "#1D4964", fontSize: 14, fontWeight: "900" },
  quickTotalSubtitle: { color: "#7891A1", fontSize: 11, fontWeight: "600", marginTop: 3 },
  quickTotalInputShell: { alignItems: "center", backgroundColor: "#F1F7FA", borderColor: "#C8DCE7", borderRadius: 12, borderWidth: 1, flexDirection: "row", height: 47, paddingHorizontal: 10, width: 138 },
  quickTotalInput: { color: "#173F5B", flex: 1, fontSize: 14, fontWeight: "900", paddingHorizontal: 6, textAlign: "right" },
  requestBanner: { alignItems: "center", backgroundColor: "#E64D5C", borderRadius: 19, flexDirection: "row", gap: 12, marginTop: 22, padding: 15 },
  requestBannerContent: { flex: 1 },
  requestBannerCopy: { color: "#FFE7E9", fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 2 },
  requestBannerIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.17)", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  requestBannerPressed: { backgroundColor: "#D74352" },
  requestBannerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  requestScroll: { marginHorizontal: "auto", maxWidth: 650, paddingBottom: 1, paddingHorizontal: 18, paddingTop: 12, width: "100%" },
  screenHeader: { alignItems: "center", backgroundColor: "#F4F7F9", flexDirection: "row", justifyContent: "space-between", maxWidth: 700, paddingHorizontal: 18, paddingTop: 8, width: "100%" },
  secondaryButton: { alignItems: "center", backgroundColor: "#EAF1F5", borderRadius: 15, flex: 0.73, justifyContent: "center", minHeight: 52, paddingHorizontal: 12 },
  secondaryButtonPressed: { backgroundColor: "#DDEAF0" },
  secondaryButtonText: { color: "#335970", fontSize: 14, fontWeight: "900" },
  sectionLabel: { color: "#698494", fontSize: 10, fontWeight: "900", letterSpacing: 1.05, marginBottom: 8, marginTop: 24 },
  selectField: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE8EF", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 13 },
  selectFieldCompact: { minHeight: 64 },
  selectFieldValue: { color: "#284C64", flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  selectGroup: { marginTop: 12 },
  sheetHandle: { alignSelf: "center", backgroundColor: "#BED0DC", borderRadius: 4, height: 4, marginBottom: 20, width: 38 },
  signOutButton: { alignItems: "center", backgroundColor: "#FFF3F4", borderColor: "#F5D7DB", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 25, minHeight: 53 },
  signOutButtonPressed: { backgroundColor: "#FFE6E8" },
  signOutText: { color: "#BD4452", fontSize: 14, fontWeight: "900" },
  submitButton: { alignItems: "center", backgroundColor: "#174F72", borderRadius: 15, flex: 1.27, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 52, paddingHorizontal: 12 },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  testAccessButton: { alignItems: "center", flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 17, paddingVertical: 4 },
  testAccessText: { color: "#23608A", fontSize: 12, fontWeight: "800" },
  toolDetail: { color: "#7890A0", fontSize: 12, marginTop: 2 },
  toolIcon: { alignItems: "center", backgroundColor: "#EAF4F8", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  toolIconHighlighted: { backgroundColor: "#FFF0F1" },
  toolLabel: { color: "#20435A", fontSize: 14, fontWeight: "800" },
  toolRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 67, paddingHorizontal: 14 },
  toolRowPressed: { backgroundColor: "#F3F8FA" },
  toolTextWrap: { flex: 1 },
  toolsCard: { backgroundColor: "#FFFFFF", borderColor: "#DFEAF0", borderRadius: 18, borderWidth: 1, marginTop: 0, overflow: "hidden" },
  totalDivider: { backgroundColor: "#D6E5EC", height: 32, width: 1 },
  totalInfo: { alignItems: "center", backgroundColor: "#E5F1F6", borderRadius: 14, height: 28, justifyContent: "center", width: 28 },
  totalLabel: { color: "#7891A1", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  totalPanel: { alignItems: "center", backgroundColor: "#EBF4F8", borderRadius: 16, flexDirection: "row", justifyContent: "space-between", marginTop: 11, padding: 13 },
  totalValue: { color: "#244D67", fontSize: 15, fontWeight: "900", marginTop: 3 },
});
