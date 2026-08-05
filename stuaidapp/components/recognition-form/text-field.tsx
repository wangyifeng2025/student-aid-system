import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  hint?: string;
  editable?: boolean;
  suffix?: string;
  style?: object;
};

export function TextField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  numberOfLines,
  hint,
  editable = true,
  suffix,
  style,
}: Props) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.control,
          multiline && styles.controlMultiline,
          !editable && styles.controlDisabled,
        ]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Brand.mutedForeground}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    color: Brand.foreground,
  },
  required: {
    color: Brand.error,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Brand.radiusSm,
    backgroundColor: Brand.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
  },
  controlMultiline: {
    height: undefined,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  controlDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Brand.foreground,
    padding: 0,
  },
  inputMultiline: {
    minHeight: 64,
  },
  suffix: {
    marginLeft: 8,
    fontSize: 13,
    color: Brand.mutedForeground,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: Brand.mutedForeground,
  },
});
