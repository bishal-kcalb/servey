import NetInfo from '@react-native-community/netinfo';

export async function isOnline() {
  const state = await NetInfo.fetch();
  return !!state.isConnected && !!state.isInternetReachable;
}

export function onConnectivityChange(cb) {
  // cb({ isOnline: boolean })
  const unsub = NetInfo.addEventListener((state) => {
    cb({ isOnline: !!state.isConnected && !!state.isInternetReachable });
  });
  return unsub;
}
