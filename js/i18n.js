/**
 * Internationalization (i18n) module for 天下太平 website
 * Handles multiple language support
 */

// Available languages with their locale codes
const AVAILABLE_LANGUAGES = {
  'zh': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'en': 'English',
  'ja': 'Japanese',
  'ko': 'Korean'
};

// Default language
const DEFAULT_LANGUAGE = 'zh';

// Translations dictionary
const translations = {
  // Chinese translations (default - Simplified)
  zh: {
    'title': '天下太平',
    'login': '登录',
    'signup': '注册',
    'logout': '退出登录',
    'welcome': '欢迎来到天下太平',
    'username': '用户名',
    'password': '密码',
    'confirm_password': '确认密码',
    'rank': '等级',
    'user_profile': '个人中心',
    'back_to_home': '返回首页',
    'login_success': '登录成功！正在跳转...',
    'login_error': '用户名或密码错误',
    'signup_success': '注册成功！正在跳转到首页...',
    'passwords_mismatch': '两次输入的密码不匹配',
    'username_exists': '用户名已存在',
    'system_error': '发生错误，请稍后再试',
    'no_account': '还没有账号?',
    'have_account': '已有账号?',
    'logout_success': '退出登录成功！正在跳转...',
    'logout_error': '退出登录失败',
    'profile_welcome_text': '您已成功登录系统，可以访问所有功能。',
    'create_room': '创建房间',
    'join_room': '加入房间',
    'room_id': '房间号'
  },
  
  // Chinese translations (Traditional)
  'zh-TW': {
    'title': '天下太平',
    'login': '登入',
    'signup': '註冊',
    'logout': '登出',
    'welcome': '歡迎來到天下太平',
    'username': '使用者名稱',
    'password': '密碼',
    'confirm_password': '確認密碼',
    'rank': '等級',
    'user_profile': '個人中心',
    'back_to_home': '返回首頁',
    'login_success': '登入成功！正在跳轉...',
    'login_error': '使用者名稱或密碼錯誤',
    'signup_success': '註冊成功！正在跳轉到首頁...',
    'passwords_mismatch': '兩次輸入的密碼不匹配',
    'username_exists': '使用者名稱已存在',
    'system_error': '發生錯誤，請稍後再試',
    'no_account': '還沒有帳號?',
    'have_account': '已有帳號?',
    'logout_success': '登出成功！正在跳轉...',
    'logout_error': '登出失敗',
    'profile_welcome_text': '您已成功登入系統，可以訪問所有功能。',
    'create_room': '創建房間',
    'join_room': '加入房間',
    'room_id': '房間號'
  },
  
  // English translations
  en: {
    'title': '天下太平',
    'login': 'Login',
    'signup': 'Sign Up',
    'logout': 'Logout',
    'welcome': 'Welcome to Peace Under Heaven',
    'username': 'Username',
    'password': 'Password',
    'confirm_password': 'Confirm Password',
    'rank': 'Rank',
    'user_profile': 'User Profile',
    'back_to_home': 'Back to Home',
    'login_success': 'Login successful! Redirecting...',
    'login_error': 'Incorrect username or password',
    'signup_success': 'Registration successful! Redirecting to home page...',
    'passwords_mismatch': 'Passwords do not match',
    'username_exists': 'Username already exists',
    'system_error': 'An error occurred, please try again later',
    'no_account': 'Don\'t have an account?',
    'have_account': 'Already have an account?',
    'logout_success': 'Logout successful! Redirecting...',
    'logout_error': 'Logout failed',
    'profile_welcome_text': 'You have successfully logged in and can access all features.',
    'create_room': 'Create Room',
    'join_room': 'Join Room',
    'room_id': 'Room ID'
  },
  
  // Japanese translations
  ja: {
    'title': '天下太平',
    'login': 'ログイン',
    'signup': '登録',
    'logout': 'ログアウト',
    'welcome': '天下泰平へようこそ',
    'username': 'ユーザー名',
    'password': 'パスワード',
    'confirm_password': 'パスワードを確認',
    'rank': 'ランク',
    'user_profile': 'ユーザープロフィール',
    'back_to_home': 'ホームに戻る',
    'login_success': 'ログイン成功！リダイレクト中...',
    'login_error': 'ユーザー名またはパスワードが正しくありません',
    'signup_success': '登録成功！ホームページにリダイレクト中...',
    'passwords_mismatch': 'パスワードが一致しません',
    'username_exists': 'ユーザー名はすでに存在します',
    'system_error': 'エラーが発生しました。後でもう一度お試しください',
    'no_account': 'アカウントをお持ちでないですか？',
    'have_account': 'すでにアカウントをお持ちですか？',
    'logout_success': 'ログアウト成功！リダイレクト中...',
    'logout_error': 'ログアウトに失敗しました',
    'profile_welcome_text': 'ログインに成功しました。すべての機能にアクセスできます。',
    'create_room': 'ルームを作成',
    'join_room': 'ルームに参加',
    'room_id': 'ルームID'
  },
  
  // Korean translations
  ko: {
    'title': '천하태평',
    'login': '로그인',
    'signup': '회원가입',
    'logout': '로그아웃',
    'welcome': '천하태평에 오신 것을 환영합니다',
    'username': '사용자 이름',
    'password': '비밀번호',
    'confirm_password': '비밀번호 확인',
    'rank': '랭크',
    'user_profile': '사용자 프로필',
    'back_to_home': '홈으로 돌아가기',
    'login_success': '로그인 성공! 리디렉션 중...',
    'login_error': '사용자 이름 또는 비밀번호가 잘못되었습니다',
    'signup_success': '등록 성공! 홈페이지로 리디렉션 중...',
    'passwords_mismatch': '비밀번호가 일치하지 않습니다',
    'username_exists': '사용자 이름이 이미 존재합니다',
    'system_error': '오류가 발생했습니다. 나중에 다시 시도해주세요',
    'no_account': '계정이 없으신가요?',
    'have_account': '이미 계정이 있으신가요?',
    'logout_success': '로그아웃 성공! 리디렉션 중...',
    'logout_error': '로그아웃 실패',
    'profile_welcome_text': '성공적으로 로그인했습니다. 모든 기능에 접근할 수 있습니다.',
    'create_room': '방 만들기',
    'join_room': '방 참가하기',
    'room_id': '방 ID'
  }
};

/**
 * I18n class for handling translations
 */
class I18n {
  constructor() {
    // Get browser language if it's supported
    this.currentLanguage = this.getBrowserLanguage() || DEFAULT_LANGUAGE;
  }
  
  /**
   * Get browser language if it's supported
   * @returns {string} Supported language code or null
   */
  getBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    
    // Check for full locale match (e.g., zh-TW)
    if (translations[browserLang]) {
      return browserLang;
    }
    
    // Check for language match only (e.g., zh from zh-HK)
    const langCode = browserLang.split('-')[0];
    return translations[langCode] ? langCode : null;
  }
  
  /**
   * Get list of available languages
   * @returns {Object} Available languages
   */
  getAvailableLanguages() {
    return AVAILABLE_LANGUAGES;
  }
  
  /**
   * Get current language
   * @returns {string} Current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }
  
  /**
   * Set current language
   * @param {string} langCode - Language code to set
   * @returns {boolean} Success status
   */
  setLanguage(langCode) {
    if (translations[langCode]) {
      this.currentLanguage = langCode;
      
      // Save to localStorage
      localStorage.setItem('language', langCode);
      
      // Trigger language change event
      const event = new CustomEvent('languageChanged', { detail: { language: langCode } });
      document.dispatchEvent(event);
      
      return true;
    }
    return false;
  }
  
  /**
   * Get translation for a key
   * @param {string} key - Translation key
   * @returns {string} Translated text or key if not found
   */
  translate(key) {
    const lang = this.currentLanguage;
    
    if (translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    
    // Fallback to default language
    if (translations[DEFAULT_LANGUAGE] && translations[DEFAULT_LANGUAGE][key]) {
      return translations[DEFAULT_LANGUAGE][key];
    }
    
    // Return key as fallback
    return key;
  }
  
  /**
   * Initialize i18n system
   */
  init() {
    // Check for stored language preference
    const storedLang = localStorage.getItem('language');
    if (storedLang && translations[storedLang]) {
      this.currentLanguage = storedLang;
    }
    
    // Apply translations to the page
    this.applyTranslations();
    
    // Set up language change listener
    document.addEventListener('languageChanged', () => {
      this.applyTranslations();
    });
  }
  
  /**
   * Apply translations to elements with data-i18n attribute
   */
  applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.translate(key);
    });
    
    // Also update placeholder attributes
    const inputElements = document.querySelectorAll('[data-i18n-placeholder]');
    inputElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.setAttribute('placeholder', this.translate(key));
    });
  }
}

// Create and export singleton instance
const i18n = new I18n();
export default i18n; 