// Firebase 함수 설정
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Firebase 앱 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// 한글 검증 함수
function containsKorean(text) {
  // 한글 유니코드 범위: AC00-D7A3 (가-힣)
  const koreanRegex = /[\uAC00-\uD7A3]/;
  return koreanRegex.test(text);
}

// 이메일 형식 검증 함수
function isValidEmail(email) {
  // '@' 문자가 포함되어 있는지 확인
  return email.includes('@');
}

// 데이터 생성 시간 검증 함수 (1분 경과 여부)
function isOneMinutePassed(timestamp) {
  if (!timestamp) return false;
  
  // Date 객체로 변환 (이미 Date 객체인 경우도 처리)
  const createdAt = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffInMs = now - createdAt;
  const diffInMinutes = diffInMs / (1000 * 60);
  
  console.log('시간 차이(분):', diffInMinutes);
  return diffInMinutes >= 1;
}

// 사용자 생성 API (HTTP 요청용)
exports.createUser = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // POST 메소드 확인
      if (req.method !== 'POST') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. POST 요청만 가능합니다.' 
        });
      }
      
      const { name, email } = req.body;
      
      // 필수 필드 확인
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: '이름과 이메일은 필수 필드입니다.'
        });
      }
      
      // 이름에 한글이 포함되어 있는지 검증
      if (containsKorean(name)) {
        return res.status(400).json({ 
          success: false, 
          message: '이름에 한글이 포함되어 있습니다. 한글은 사용할 수 없습니다.' 
        });
      }
      
      // 이메일 형식 검증
      if (!isValidEmail(email)) {
        return res.status(400).json({ 
          success: false, 
          message: '유효하지 않은 이메일 형식입니다. 이메일에는 반드시 @ 문자가 포함되어야 합니다.' 
        });
      }
      
      // 사용자 데이터 생성
      const userRef = db.collection('users').doc();
      const now = new Date();
      const userData = {
        name,
        email,
        createdAt: now,
        updatedAt: now
      };
      
      await userRef.set(userData);
      
      return res.status(201).json({ 
        success: true, 
        message: '사용자가 성공적으로 생성되었습니다.',
        userId: userRef.id,
        user: userData
      });
      
    } catch (error) {
      console.error('사용자 생성 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});

// 사용자 이름으로 조회 API (HTTP 요청용)
exports.getUserByName = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // GET 메소드 확인
      if (req.method !== 'GET') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. GET 요청만 가능합니다.' 
        });
      }
      
      const name = req.query.name;
      
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          message: '이름 매개변수가 필요합니다.' 
        });
      }
      
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('name', '==', name).get();
      
      if (snapshot.empty) {
        return res.status(404).json({ 
          success: false, 
          message: '해당 이름의 사용자를 찾을 수 없습니다.' 
        });
      }
      
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Firestore Timestamp를 일반 Date로 변환
        const userData = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : null,
          updatedAt: data.updatedAt ? new Date(data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : null
        };
        users.push(userData);
      });
      
      return res.status(200).json({ 
        success: true, 
        users 
      });
      
    } catch (error) {
      console.error('사용자 조회 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});

// 이메일 수정 API (HTTP 요청용)
exports.updateEmail = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // PUT 메소드 확인
      if (req.method !== 'PUT') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. PUT 요청만 가능합니다.' 
        });
      }
      
      // req.body나 req.query에서 파라미터 가져오기
      const userId = req.query.userId || (req.body && req.body.userId);
      const newEmail = req.query.newEmail || (req.body && req.body.newEmail);
      
      if (!userId || !newEmail) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId와 newEmail 매개변수가 필요합니다.' 
        });
      }
      
      // 이메일 형식 검증
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ 
          success: false, 
          message: '유효하지 않은 이메일 형식입니다. 이메일에는 반드시 @ 문자가 포함되어야 합니다.' 
        });
      }
      
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ 
          success: false, 
          message: '해당 ID의 사용자를 찾을 수 없습니다.' 
        });
      }
      
      await userRef.update({
        email: newEmail,
        updatedAt: new Date()
      });
      
      return res.status(200).json({ 
        success: true, 
        message: '이메일이 성공적으로 수정되었습니다.' 
      });
      
    } catch (error) {
      console.error('이메일 수정 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});

// 이름으로 사용자 이메일 수정 API (HTTP 요청용)
exports.updateEmailByName = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // PUT 메소드 확인
      if (req.method !== 'PUT') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. PUT 요청만 가능합니다.' 
        });
      }
      
      // req.body나 req.query에서 파라미터 가져오기
      const name = req.query.name || (req.body && req.body.name);
      const newEmail = req.query.newEmail || (req.body && req.body.newEmail);
      
      if (!name || !newEmail) {
        return res.status(400).json({ 
          success: false, 
          message: 'name과 newEmail 매개변수가 필요합니다.' 
        });
      }
      
      // 이메일 형식 검증
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ 
          success: false, 
          message: '유효하지 않은 이메일 형식입니다. 이메일에는 반드시 @ 문자가 포함되어야 합니다.' 
        });
      }
      
      // 이름으로 사용자 찾기
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('name', '==', name).get();
      
      if (snapshot.empty) {
        return res.status(404).json({ 
          success: false, 
          message: '해당 이름의 사용자를 찾을 수 없습니다.' 
        });
      }
      
      // 여러 사용자가 있을 경우 처리
      if (snapshot.size > 1) {
        return res.status(409).json({
          success: false,
          message: '동일한 이름의 사용자가 여러 명 존재합니다. userId를 사용하여 수정해주세요.'
        });
      }
      
      // 단일 사용자 업데이트
      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({
        email: newEmail,
        updatedAt: new Date()
      });
      
      return res.status(200).json({ 
        success: true, 
        message: '이메일이 성공적으로 수정되었습니다.',
        userId: userDoc.id
      });
      
    } catch (error) {
      console.error('이메일 수정 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});

// 사용자 삭제 API (HTTP 요청용)
exports.deleteUser = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // DELETE 메소드 확인
      if (req.method !== 'DELETE') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. DELETE 요청만 가능합니다.' 
        });
      }
      
      // DELETE 요청에서는 URL 쿼리 파라미터나 body에서 userId를 가져옴
      const userId = req.query.userId || (req.body && req.body.userId);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId 매개변수가 필요합니다.' 
        });
      }
      
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ 
          success: false, 
          message: '해당 ID의 사용자를 찾을 수 없습니다.' 
        });
      }
      
      const userData = userDoc.data();
      
      // createdAt 필드 확인
      if (!userData.createdAt) {
        return res.status(400).json({
          success: false,
          message: '사용자 생성 시간 정보가 없습니다.'
        });
      }
      
      // 생성 후 1분 경과 여부 확인
      const createdAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
      if (!isOneMinutePassed(createdAt)) {
        return res.status(403).json({ 
          success: false, 
          message: '생성 후 1분이 경과하지 않은 사용자는 삭제할 수 없습니다.' 
        });
      }
      
      await userRef.delete();
      
      return res.status(200).json({ 
        success: true, 
        message: '사용자가 성공적으로 삭제되었습니다.' 
      });
      
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});

// 이름으로 사용자 삭제 API (HTTP 요청용)
exports.deleteUserByName = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // DELETE 메소드 확인
      if (req.method !== 'DELETE') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. DELETE 요청만 가능합니다.' 
        });
      }
      
      // DELETE 요청에서는 URL 쿼리 파라미터나 body에서 name을 가져옴
      const name = req.query.name || (req.body && req.body.name);
      
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          message: 'name 매개변수가 필요합니다.' 
        });
      }
      
      // 이름으로 사용자 찾기
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('name', '==', name).get();
      
      if (snapshot.empty) {
        return res.status(404).json({ 
          success: false, 
          message: '해당 이름의 사용자를 찾을 수 없습니다.' 
        });
      }
      
      // 여러 사용자가 있을 경우 처리
      if (snapshot.size > 1) {
        return res.status(409).json({
          success: false,
          message: '동일한 이름의 사용자가 여러 명 존재합니다. userId를 사용하여 삭제해주세요.'
        });
      }
      
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      
      // 생성 후 1분 경과 여부 확인
      const createdAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
      if (!isOneMinutePassed(createdAt)) {
        return res.status(403).json({ 
          success: false, 
          message: '생성 후 1분이 경과하지 않은 사용자는 삭제할 수 없습니다.' 
        });
      }
      
      await userDoc.ref.delete();
      
      return res.status(200).json({ 
        success: true, 
        message: '사용자가 성공적으로 삭제되었습니다.',
        userId: userDoc.id
      });
      
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});

// 모든 사용자 조회 API (추가 기능)
exports.getAllUsers = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // GET 메소드 확인
      if (req.method !== 'GET') {
        return res.status(405).json({ 
          success: false, 
          message: '허용되지 않은 메소드입니다. GET 요청만 가능합니다.' 
        });
      }
      
      const usersRef = db.collection('users');
      const snapshot = await usersRef.get();
      
      if (snapshot.empty) {
        return res.status(404).json({ 
          success: false, 
          message: '사용자가 없습니다.' 
        });
      }
      
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const userData = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : null,
          updatedAt: data.updatedAt ? new Date(data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : null
        };
        users.push(userData);
      });
      
      return res.status(200).json({ 
        success: true, 
        users 
      });
      
    } catch (error) {
      console.error('모든 사용자 조회 오류:', error);
      return res.status(500).json({ 
        success: false, 
        message: '서버 오류가 발생했습니다.', 
        error: error.message 
      });
    }
  });
});