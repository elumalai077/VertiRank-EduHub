import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import DeviceInfo from "react-native-device-info";

const LOGOUT_API =
  "https://3k4ygdloz8.execute-api.ap-south-1.amazonaws.com/dev/Log_out";

export default function LogoutScreen() {
  const logout = async () => {
    try {
      const academyId =
        await AsyncStorage.getItem(
          "academyId"
        );

      const gmail =
        await AsyncStorage.getItem(
          "gmail"
        );

      const deviceId =
        await DeviceInfo.getUniqueId();

      await axios.post(LOGOUT_API, {
        academyId,
        gmail,
        deviceId,
      });

      await AsyncStorage.clear();

      Alert.alert("Success", "Logged Out");
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          "Logout Failed"
      );
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TouchableOpacity
        onPress={logout}
        style={{
          backgroundColor: "red",
          padding: 15,
          borderRadius: 10,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          Logout
        </Text>
      </TouchableOpacity>
    </View>
  );
}